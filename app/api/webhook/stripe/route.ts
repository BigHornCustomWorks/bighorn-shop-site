import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  cartHasShippedGoods,
  collectDigitalDownloads,
  digitalSlugsInCart,
  webhookDigitalAction,
  type DigitalDownload,
} from "@/lib/digital-delivery";
import { sendDigitalDeliveryEmail, sendOrderEmail } from "@/lib/email";
import { fulfillmentFromCart, smsOptInFromCustomFields } from "@/lib/order-history";
import { formatUsd } from "@/lib/money";
import { newId } from "@/lib/sanitize";
import { emptyShipAddress, normalizeShipAddress } from "@/lib/shipping";
import { readStore, writeStore } from "@/lib/store";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * One buyer download email. The order row is marked "sending" before the
 * message goes out, so a Stripe retry during that send does not send a second
 * copy. `hold` is the request that already wrote "sending".
 */
async function deliverDigitalDownload(opts: {
  orderId: string;
  email: string;
  name: string;
  downloads: DigitalDownload[];
  alsoPhysical: boolean;
  digitalSlugs: string[];
  hold?: boolean;
}) {
  if (!opts.downloads.length) return;
  const claimed = await readStore();
  const row = claimed.orders.find((o) => o.id === opts.orderId);
  if (!row || row.digitalEmailed) return;
  if (!opts.hold) {
    if (row.digitalEmailError === "sending") return;
    row.digitalEmailError = "sending";
    if (opts.digitalSlugs.length && !(row.digitalSlugs || []).length) row.digitalSlugs = opts.digitalSlugs;
    await writeStore(claimed);
  }

  let ok = false;
  let error = "The download email did not send. Use Email download links on the order.";
  try {
    const sent = await sendDigitalDeliveryEmail({
      to: opts.email,
      name: opts.name,
      downloads: opts.downloads,
      alsoPhysical: opts.alsoPhysical,
    });
    ok = sent.ok;
    if (!sent.ok) error = sent.error;
  } catch (err) {
    console.error("digital delivery", err instanceof Error ? err.message : err);
  }

  const after = await readStore();
  const saved = after.orders.find((o) => o.id === opts.orderId);
  if (!saved) return;
  saved.digitalEmailed = ok;
  saved.digitalEmailError = ok ? "" : error.slice(0, 300);
  await writeStore(after);
}

function addressLines(addr?: Stripe.Address | null): string {
  if (!addr) return "";
  return [addr.line1, addr.line2, [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "), addr.country]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  const store = await readStore();
  const stripe = stripeClient(store);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ received: true });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const raw = event.data.object as Stripe.Checkout.Session;
    try {
      const session = await stripe.checkout.sessions.retrieve(raw.id, {
        expand: ["line_items", "shipping_cost.shipping_rate"],
      });
      const meta = session.metadata || {};
      const signNote =
        meta.kind === "sign-estimate" && meta.widthIn && meta.heightIn
          ? `\n  ${meta.widthIn} × ${meta.heightIn} in${meta.areaLabel ? ` · ${meta.areaLabel}` : ""}${
              meta.rateLabel ? ` · ${meta.rateLabel}` : ""
            }`
          : "";
      const items =
        (session.line_items?.data || [])
          .map((line) => {
            const qty = line.quantity || 1;
            const name = line.description || "Item";
            return `• ${qty} × ${name}`;
          })
          .join("\n") + signNote;
      const extra = session as Stripe.Checkout.Session & {
        shipping_details?: { name?: string | null; address?: Stripe.Address | null };
      };
      const ship =
        extra.collected_information?.shipping_details?.address ||
        extra.shipping_details?.address ||
        extra.customer_details?.address;
      const name =
        extra.collected_information?.shipping_details?.name ||
        extra.shipping_details?.name ||
        extra.customer_details?.name ||
        "";
      const email = session.customer_details?.email || session.customer_email || "";
      const phone = session.customer_details?.phone || "";
      const smsOptIn = smsOptInFromCustomFields(session.custom_fields);
      const amountCents = session.amount_total || 0;
      const address = addressLines(ship || null);
      const shippingRate = session.shipping_cost?.shipping_rate;
      const shippingLabel =
        shippingRate && typeof shippingRate !== "string" ? shippingRate.display_name || "" : "";
      const shippingCents = session.shipping_cost?.amount_total || 0;
      const taxCents = session.total_details?.amount_tax || 0;
      // Live carrier rate: only recorded when the customer kept it on the
      // Stripe page (they may have switched to pickup instead).
      const chosenRateMeta =
        shippingRate && typeof shippingRate !== "string" ? shippingRate.metadata || {} : {};
      const liveChosen = Boolean(meta.shipRateId) && chosenRateMeta.shippo_rate_id === meta.shipRateId;
      const shipTo = ship
        ? normalizeShipAddress({
            name,
            street1: ship.line1,
            street2: ship.line2,
            city: ship.city,
            state: ship.state,
            zip: ship.postal_code,
            country: ship.country,
            phone,
            email,
          })
        : emptyShipAddress();
      // Stripe retries this webhook on any timeout or non-2xx. Claim the
      // order row FIRST so a retry sees it and stops, instead of sending a
      // second copy of the same order to the shop inbox. A missed download
      // email can still go out once; a finished one is not sent again.
      const latest = await readStore();
      const stockNote = meta.items || "";
      const itemSlugs = stockNote
        .split(",")
        .filter(Boolean)
        .map((part) => part.split(":")[0] || "")
        .filter(Boolean);
      const downloads = collectDigitalDownloads(itemSlugs, latest.products);
      const digitalSlugs = digitalSlugsInCart(itemSlugs, latest.products);
      const alsoPhysical = cartHasShippedGoods(itemSlugs, latest.products);
      const existing = latest.orders.find((o) => o.sessionId === session.id);
      if (existing) {
        if (webhookDigitalAction(existing, downloads.length) === "send") {
          await deliverDigitalDownload({
            orderId: existing.id,
            email,
            name,
            downloads,
            alsoPhysical,
            digitalSlugs,
          });
        }
        return NextResponse.json({ received: true });
      }

      const orderId = newId("order");
      const fulfillment = fulfillmentFromCart(
        meta.fulfillment || "",
        itemSlugs,
        latest.products.map((p) => ({ slug: p.slug, kind: p.kind })),
      );
      for (const part of stockNote.split(",").filter(Boolean)) {
        const match = part.match(/^([^:]+):(.*)x(\d+)$/);
        if (!match) continue;
        const qty = Number(match[3]) || 1;
        const variantName = match[2];
        const product = latest.products.find((p) => p.slug === match[1]);
        if (!product) continue;
        const variant = product.variants.find(
          (v) => v.name === variantName || v.name.toLowerCase() === variantName.toLowerCase(),
        );
        if (variant && variant.onHand != null && variant.onHand > 0) {
          variant.onHand = Math.max(0, variant.onHand - qty);
          continue;
        }
        if (product.onHand == null || product.onHand <= 0) continue;
        product.onHand = Math.max(0, product.onHand - qty);
      }
      latest.orders = [
        {
          id: orderId,
          createdAt: new Date().toISOString(),
          email,
          name,
          phone,
          smsOptIn,
          reviewRequestedAt: "",
          repairReviewRequestedAt: "",
          amountCents,
          items,
          address,
          sessionId: session.id,
          shippingLabel,
          fulfillment: fulfillment || (meta.fulfillment === "pickup" ? "pickup" : "ship"),
          shippingCents,
          taxCents,
          trackingCarrier: "",
          trackingNumber: "",
          shippedAt: "",
          customerNotified: false,
          emailed: false,
          read: false,
          paymentStatus: session.payment_status || "",
          shipTo,
          rateId: liveChosen ? meta.shipRateId || "" : "",
          rateShipmentId: liveChosen ? meta.shipShipmentId || "" : "",
          rateCarrier: liveChosen ? meta.shipCarrier || "" : "",
          rateService: liveChosen ? meta.shipService || "" : "",
          rateServiceToken: liveChosen ? meta.shipServiceToken || "" : "",
          rateCents: liveChosen ? shippingCents : 0,
          labelRateId: "",
          labelStatus: "",
          labelStartedAt: "",
          labelError: "",
          labelUrl: "",
          labelTrackingUrl: "",
          labelCarrier: "",
          labelService: "",
          labelCents: 0,
          labelBoughtAt: "",
          digitalSlugs,
          digitalEmailed: false,
          digitalEmailError: downloads.length ? "sending" : "",
          includesShippedGoods: alsoPhysical,
        },
        ...latest.orders,
      ].slice(0, 400);
      const reserved = await writeStore(latest);
      if (!reserved.ok) {
        // Not fatal — the email below still reaches the shop — but the order
        // list and the retry guard above are both unreliable until Blob is on.
        console.error("order row not persisted", reserved.persisted, session.id);
      }

      const emailed = await sendOrderEmail({
        email,
        name,
        amountLabel: formatUsd(amountCents),
        items,
        address,
        sessionId: session.id,
        paid: session.payment_status === "paid",
        shippingLabel,
        shippingLabelCost: formatUsd(shippingCents),
        taxLabel: formatUsd(taxCents),
      });

      if (emailed) {
        const after = await readStore();
        const row = after.orders.find((o) => o.id === orderId);
        if (row && !row.emailed) {
          row.emailed = true;
          await writeStore(after);
        }
      }

      if (downloads.length) {
        await deliverDigitalDownload({
          orderId,
          email,
          name,
          downloads,
          alsoPhysical,
          digitalSlugs,
          hold: true,
        });
      }
    } catch (err) {
      console.error("order notify", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ received: true });
}
