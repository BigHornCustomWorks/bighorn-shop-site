import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { sendOrderEmail } from "@/lib/email";
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
    try {
      const session = await stripe.checkout.sessions.retrieve(raw.id, {
        expand: ["line_items", "shipping_cost.shipping_rate"],
      });
      const items = (session.line_items?.data || [])
        .map((line) => {
          const qty = line.quantity || 1;
          const name = line.description || "Item";
          return `• ${qty} × ${name}`;
        })
        .join("\n");
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
