import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { orderFulfillment } from "@/lib/order-history";
import { customerShipLines, packingSlipFromOrder, packingSlipSheet, paperDocument } from "@/lib/paper";
import { receiptSheet } from "@/lib/receipt";
import { paidWithLabel } from "@/lib/paid-with";
import { cleanStr } from "@/lib/sanitize";
import { shipFromAddress } from "@/lib/shipping";
import { readStore } from "@/lib/store";
import { siteUrl } from "@/lib/stripe";
import type { ShopStore } from "@/lib/types";

export const runtime = "nodejs";

function logoUrl(store: ShopStore): string {
  const raw = (store.site.logoUrl || "/logo.png").trim();
  if (raw.startsWith("https://")) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const origin = siteUrl();
  const base = origin.startsWith("https://") ? origin : "https://bighorncustomworks.com";
  return `${base}${path}`;
}

function html(title: string, sheets: string[], status: number, autoPrint: boolean) {
  return new NextResponse(paperDocument(title, sheets, autoPrint), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function GET(req: Request) {
  if (!(await isMaster())) {
    return new NextResponse("Sign in to Master Control first.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }

  const url = new URL(req.url);
  const orderId = cleanStr(url.searchParams.get("orderId"));
  const kind = url.searchParams.get("kind");
  const companyFallback = "Big Horn Custom Works";
  if (!orderId) {
    return html("Print", ["<section class=\"sheet\"><p>Pick an order first.</p></section>"], 400, false);
  }

  const store = await readStore();
  const order = store.orders.find((row) => row.id === orderId);
  if (!order) {
    return html("Print", ["<section class=\"sheet\"><p>That order is not in the list.</p></section>"], 404, false);
  }

  const company = (store.site.companyName || companyFallback).trim() || companyFallback;
  const wantSlip = kind === "slip" || kind === "both";
  const wantReceipt = kind !== "slip";
  const mailing = orderFulfillment(order) === "ship";
  const sheets: string[] = [];

  if (wantSlip && mailing) {
    const from = shipFromAddress(store.settings)?.address || null;
    sheets.push(packingSlipSheet(packingSlipFromOrder(order, { company, from })));
  } else if (kind === "slip") {
    const why = orderFulfillment(order) === "pickup" ? "This order is pickup in Sheridan." : "This order is not being mailed.";
    return html("Packing slip", [`<section class="sheet"><p>${why}</p></section>`], 400, false);
  }

  if (wantReceipt) {
    const paymentMethod = await paidWithLabel(store, order.sessionId);
    const address = mailing ? customerShipLines(order) : order.fulfillment === "digital" ? "" : order.address;
    sheets.push(
      receiptSheet(
        {
          id: order.id,
          createdAt: order.createdAt,
          name: order.name,
          items: order.items,
          address,
          fulfillment: order.fulfillment,
          shippingLabel: order.shippingLabel,
          shippingCents: order.shippingCents,
          taxCents: order.taxCents,
          amountCents: order.amountCents,
          paymentStatus: order.paymentStatus,
          paymentMethod,
        },
        { logoUrl: logoUrl(store), company },
      ),
    );
  }

  const title = wantSlip && wantReceipt ? "Receipt and packing slip" : wantSlip ? "Packing slip" : "Receipt";
  return html(`${company} ${title}`, sheets, 200, true);
}
