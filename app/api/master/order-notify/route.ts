import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { sendOrderEmail } from "@/lib/email";
import { formatUsd } from "@/lib/money";
import { cleanStr } from "@/lib/sanitize";
import { readStore, writeStore } from "@/lib/store";

export const runtime = "nodejs";

/** Re-send the shop notification email for one saved order (Master Control only). */
export async function POST(req: Request) {
  if (!(await isMaster())) return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const orderId = cleanStr(body.orderId);
  if (!orderId) return NextResponse.json({ error: "Pick an order." }, { status: 400 });

  const store = await readStore();
  const order = store.orders.find((o) => o.id === orderId);
  if (!order) return NextResponse.json({ error: "That order is not in the list." }, { status: 404 });

  const sent = await sendOrderEmail({
    email: order.email,
    name: order.name,
    phone: order.phone,
    amountLabel: formatUsd(order.amountCents),
    items: order.items,
    address: order.address,
    sessionId: order.sessionId,
    paymentIntentId: order.paymentIntentId,
    paid: order.paymentStatus === "paid",
    shippingLabel: order.shippingLabel,
    shippingLabelCost: formatUsd(order.shippingCents),
    taxLabel: formatUsd(order.taxCents),
  });

  order.emailed = sent.ok;
  order.notifyError = sent.ok ? "" : sent.error;
  const saved = await writeStore(store);

  return NextResponse.json({
    ok: sent.ok,
    via: sent.via,
    error: sent.error,
    saved: saved.ok,
  });
}
