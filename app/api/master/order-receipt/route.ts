import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { sendReceiptEmail } from "@/lib/email";
import { cleanStr } from "@/lib/sanitize";
import { readStore, writeStore } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isMaster())) {
    return NextResponse.json({ error: "Sign in to Master Control first." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = cleanStr(body.orderId);
  if (!orderId) return NextResponse.json({ error: "Pick an order first." }, { status: 400 });

  const store = await readStore();
  const order = store.orders.find((row) => row.id === orderId);
  if (!order) return NextResponse.json({ error: "That order is not in the list." }, { status: 404 });
  if (!order.email.trim()) {
    return NextResponse.json({ error: "This order has no customer email." }, { status: 400 });
  }
  if (order.receiptEmailedAt && body.again !== true) {
    return NextResponse.json(
      {
        error: `A receipt was already emailed ${order.receiptEmailedAt}. Send again only if you mean to.`,
        already: true,
        receiptEmailedAt: order.receiptEmailedAt,
      },
      { status: 409 },
    );
  }

  const sent = await sendReceiptEmail({
    to: order.email,
    id: order.id,
    createdAt: order.createdAt,
    name: order.name,
    items: order.items,
    address: order.address,
    fulfillment: order.fulfillment,
    shippingLabel: order.shippingLabel,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    amountCents: order.amountCents,
    paymentStatus: order.paymentStatus,
  });
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });

  const sentAt = new Date().toISOString();
  order.receiptEmailedAt = sentAt;
  const saved = await writeStore(store);
  if (!saved.ok) {
    return NextResponse.json(
      {
        error: "The receipt was sent, but the order did not save. Refresh before sending again.",
        receiptEmailedAt: sentAt,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, receiptEmailedAt: sentAt });
}
