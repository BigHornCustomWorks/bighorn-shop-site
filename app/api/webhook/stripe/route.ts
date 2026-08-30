import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { sendOrderEmail } from "@/lib/email";
import { formatUsd } from "@/lib/money";
import { readStore } from "@/lib/store";
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
        expand: ["line_items"],
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
      await sendOrderEmail({
        email: session.customer_details?.email || session.customer_email || "",
        name,
        amountLabel: formatUsd(session.amount_total || 0),
        items,
        address: addressLines(ship || null),
        sessionId: session.id,
        paid: session.payment_status === "paid",
      });
    } catch {
      /* payment already succeeded; do not fail the webhook */
    }
  }

  return NextResponse.json({ received: true });
}
