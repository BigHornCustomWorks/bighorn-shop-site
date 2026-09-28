import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { sendReviewRequestEmail } from "@/lib/email";
import { cleanStr, safeUrl } from "@/lib/sanitize";
import { readStore, writeStore } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isMaster())) return NextResponse.json({ error: "Sign in to Master Control first." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const orderId = cleanStr(body.orderId);
  if (!orderId) return NextResponse.json({ error: "Pick an order first." }, { status: 400 });

  const store = await readStore();
  const order = store.orders.find((row) => row.id === orderId);
  if (!order) return NextResponse.json({ error: "That order is not in the list." }, { status: 404 });

  if (order.reviewRequestedAt && body.again !== true) {
    return NextResponse.json(
      {
        error: `A review request was already sent ${order.reviewRequestedAt}. Send again only if you mean to.`,
        already: true,
        reviewRequestedAt: order.reviewRequestedAt,
      },
      { status: 409 },
    );
  }

  const reviewUrl = safeUrl(store.site.googleReviewUrl);
  if (!reviewUrl) {
    return NextResponse.json(
      { error: "Add a Google review link in Settings, then save, before sending." },
      { status: 400 },
    );
  }
  if (!order.email.trim()) {
    return NextResponse.json({ error: "This order has no customer email." }, { status: 400 });
  }

  const sent = await sendReviewRequestEmail({
    to: order.email,
    name: order.name,
    reviewUrl,
  });
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });

  order.reviewRequestedAt = new Date().toISOString();
  const saved = await writeStore(store);
  if (!saved.ok) {
    return NextResponse.json(
      {
        error: "The email was sent, but the order history did not save. Refresh and check before sending again.",
        reviewRequestedAt: order.reviewRequestedAt,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, reviewRequestedAt: order.reviewRequestedAt });
}
