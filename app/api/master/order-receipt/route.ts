import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { sendReceiptEmail } from "@/lib/email";
import { paidWithLabel } from "@/lib/paid-with";
import { receiptComment } from "@/lib/receipt";
import { cleanMultiline, cleanStr } from "@/lib/sanitize";
import { readStore, writeStore } from "@/lib/store";
import { siteUrl } from "@/lib/stripe";
import type { ShopOrder, ShopStore } from "@/lib/types";

export const runtime = "nodejs";

function receiptLogoUrl(store: ShopStore): string {
  const raw = (store.site.logoUrl || "/logo.png").trim();
  if (raw.startsWith("https://")) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const origin = siteUrl();
  const base = origin.startsWith("https://") ? origin : "https://bighorncustomworks.com";
  return `${base}${path}`;
}

function receiptFields(order: ShopOrder, paymentMethod: string) {
  return {
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
    paymentMethod,
  };
}

export async function GET(req: Request) {
  if (!(await isMaster())) {
    return NextResponse.json({ error: "Sign in to Master Control first." }, { status: 401 });
  }
  const orderId = cleanStr(new URL(req.url).searchParams.get("orderId"));
  if (!orderId) return NextResponse.json({ error: "Pick an order first." }, { status: 400 });

  const store = await readStore();
  const order = store.orders.find((row) => row.id === orderId);
  if (!order) return NextResponse.json({ error: "That order is not in the list." }, { status: 404 });
  if (!order.email.trim()) {
    return NextResponse.json({ error: "This order has no customer email." }, { status: 400 });
  }

  const paymentMethod = await paidWithLabel(store, order.sessionId);
  return NextResponse.json({
    to: order.email,
    logoUrl: receiptLogoUrl(store),
    receipt: receiptFields(order, paymentMethod),
  });
}

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

  const paymentMethod = await paidWithLabel(store, order.sessionId);
  const sent = await sendReceiptEmail({
    to: order.email,
    logoUrl: receiptLogoUrl(store),
    comment: receiptComment(cleanMultiline(body.comment)),
    ...receiptFields(order, paymentMethod),
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
