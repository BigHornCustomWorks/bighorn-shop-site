import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { sendOrderEmail, type SendResult } from "@/lib/email";
import { formatUsd } from "@/lib/money";
import { newId } from "@/lib/sanitize";
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
    let orderId = "";
    let notice: Parameters<typeof sendOrderEmail>[0];
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
      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "";
      const paymentStatus = session.payment_status || "";
      const amountCents = session.amount_total || 0;
      const address = addressLines(ship || null);
      const shippingRate = session.shipping_cost?.shipping_rate;
      const shippingLabel =
        shippingRate && typeof shippingRate !== "string" ? shippingRate.display_name || "" : "";
      const shippingCents = session.shipping_cost?.amount_total || 0;
      const taxCents = session.total_details?.amount_tax || 0;
      notice = {
        email,
        name,
        phone,
        amountLabel: formatUsd(amountCents),
        items,
        address,
        sessionId: session.id,
        paymentIntentId,
        paid: paymentStatus === "paid",
        shippingLabel,
        shippingLabelCost: formatUsd(shippingCents),
        taxLabel: formatUsd(taxCents),
      };
      // Stripe retries this webhook on any timeout or non-2xx. Claim the
      // order row FIRST so a retry sees it and stops, instead of sending a
      // second copy of the same order to the shop inbox.
      const latest = await readStore();
      if (latest.orders.some((o) => o.sessionId === session.id)) {
        return NextResponse.json({ received: true });
      }

      orderId = newId("order");
      latest.orders = [
        {
          id: orderId,
          createdAt: new Date().toISOString(),
          email,
          name,
          phone,
          amountCents,
          items,
          address,
          sessionId: session.id,
          paymentIntentId,
          paymentStatus,
          shippingLabel,
          shippingCents,
          taxCents,
          trackingCarrier: "",
          trackingNumber: "",
          shippedAt: "",
          customerNotified: false,
          emailed: false,
          notifyError: "",
          read: false,
        },
        ...latest.orders,
      ].slice(0, 400);
      const reserved = await writeStore(latest);
      if (!reserved.ok) {
        // The order is not durably saved. Tell the shop anyway, then answer
        // 500 so Stripe retries; the guard above stops a duplicate row once
        // storage works again (the shop may get this email more than once).
        console.error("order row not persisted", reserved.persisted, reserved.error, event.id, session.id);
        await sendOrderEmail({
          ...notice,
          warning: "This order could NOT be saved to Master Control (storage error). Stripe will retry, so this email may repeat.",
        }).catch(() => undefined);
        return NextResponse.json({ error: "order not saved" }, { status: 500 });
      }
    } catch (err) {
      console.error("order not saved", event.id, raw.id, err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "order not saved" }, { status: 500 });
    }

    // The order row is saved. Anything from here on only affects the shop
    // notification, so the webhook still answers 200 and Stripe does not retry.
    let sent: SendResult;
    try {
      sent = await sendOrderEmail(notice);
    } catch (err) {
      sent = { ok: false, via: "", error: err instanceof Error ? err.message : "notify threw" };
    }
    if (!sent.ok) console.error("order notify failed", event.id, raw.id, sent.error);

    try {
      const after = await readStore();
      const row = after.orders.find((o) => o.id === orderId);
      if (row) {
        row.emailed = sent.ok;
        row.notifyError = sent.ok ? "" : sent.error;
        await writeStore(after);
      } else {
        console.error("order row missing when recording notify result", orderId, sent.ok);
      }
    } catch (err) {
      console.error("notify result not recorded", orderId, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ received: true });
}
