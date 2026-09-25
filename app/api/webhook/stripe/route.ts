import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { sendOrderEmail } from "@/lib/email";
import { formatUsd } from "@/lib/money";
import { newId } from "@/lib/sanitize";
import { emptyShipAddress, normalizeShipAddress } from "@/lib/shipping";
import { readStore, writeStore } from "@/lib/store";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

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
            phone: session.customer_details?.phone || "",
            email,
          })
        : emptyShipAddress();
      // Stripe retries this webhook on any timeout or non-2xx. Claim the
      // order row FIRST so a retry sees it and stops, instead of sending a
      // second copy of the same order to the shop inbox.
      const latest = await readStore();
      if (latest.orders.some((o) => o.sessionId === session.id)) {
        return NextResponse.json({ received: true });
      }

      const orderId = newId("order");
      latest.orders = [
        {
          id: orderId,
          createdAt: new Date().toISOString(),
          email,
          name,
          amountCents,
          items,
          address,
          sessionId: session.id,
          shippingLabel,
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
    } catch (err) {
      console.error("order notify", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ received: true });
}
