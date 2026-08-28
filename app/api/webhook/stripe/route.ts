import { NextResponse } from "next/server";
import Stripe from "stripe";
import { readStore } from "@/lib/store";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const store = await readStore();
  const stripe = stripeClient(store);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ received: true });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  try {
    stripe.webhooks.constructEvent(body, sig, secret) as Stripe.Event;
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  return NextResponse.json({ received: true });
}
