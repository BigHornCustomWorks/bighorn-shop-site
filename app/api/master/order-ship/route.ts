import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { sendShippedEmail } from "@/lib/email";
import { cleanStr } from "@/lib/sanitize";
import { readStore, writeStore } from "@/lib/store";
import { carrierName, trackingUrl } from "@/lib/tracking";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isMaster())) return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const orderId = cleanStr(body.orderId);
  const carrier = cleanStr(body.carrier);
  const trackingNumber = cleanStr(body.trackingNumber).replace(/\s+/g, "");

  if (!orderId || !trackingNumber) {
    return NextResponse.json({ error: "Pick an order and enter a tracking number." }, { status: 400 });
  }

  const store = await readStore();
  const order = store.orders.find((o) => o.id === orderId);
  if (!order) return NextResponse.json({ error: "That order is not in the list." }, { status: 404 });

  order.trackingCarrier = carrier;
  order.trackingNumber = trackingNumber;
  order.shippedAt = new Date().toISOString();

  let notified = false;
  let emailError = "";
  if (!order.email) {
    emailError = "This order has no customer email, so nothing was sent.";
  } else {
    notified = await sendShippedEmail({
      to: order.email,
      name: order.name,
      carrier: carrierName(carrier),
      trackingNumber,
      trackingUrl: trackingUrl(carrier, trackingNumber),
      items: order.items,
    });
    if (!notified) {
      emailError = "Tracking saved, but the email did not send. Check SMTP_USER / SMTP_PASS.";
    }
  }
  order.customerNotified = notified;

  const result = await writeStore(store);
  if (!result.ok) {
    emailError = emailError || "Tracking was not saved durably — connect a Vercel Blob store.";
  }

  return NextResponse.json({
    ok: result.ok,
    notified,
    error: emailError,
    shippedAt: order.shippedAt,
  });
}
