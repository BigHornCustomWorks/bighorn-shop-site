import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { asInt, cleanStr } from "@/lib/sanitize";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const itemsIn = Array.isArray(body.items) ? body.items : [];
    const store = await readStore();
    const items = itemsIn
      .map((row: { productId?: string; quantity?: number; variant?: string }) => {
        const product = store.products.find((p) => p.id === cleanStr(row.productId) && p.visible);
        if (!product) return null;
        return {
          product,
          quantity: asInt(row.quantity, 1),
          variant: cleanStr(row.variant),
        };
      })
      .filter(Boolean) as { product: (typeof store.products)[0]; quantity: number; variant: string }[];

    if (!items.length) {
      return NextResponse.json({ error: "Cart is empty or those parts are hidden." }, { status: 400 });
    }

    const session = await createCheckoutSession(store, items, cleanStr(body.email) || undefined);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
