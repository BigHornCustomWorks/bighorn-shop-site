import { NextResponse } from "next/server";
import { createCheckoutSession, createSignCheckoutSession } from "@/lib/stripe";
import { resolveCartItems } from "@/lib/cart-items";
import { cleanStr } from "@/lib/sanitize";
import {
  buildParcel,
  checkCartRate,
  retrieveRate,
  retrieveShipment,
  shipFromAddress,
  shippoConfig,
  signParcel,
  type LiveRate,
  type Parcel,
} from "@/lib/shipping";
import { estimateSign } from "@/lib/sign-price";
import { readStore } from "@/lib/store";
import type { ShopStore } from "@/lib/types";

export const runtime = "nodejs";

type RateLookup = { rate: LiveRate | null; invalid: boolean };

/**
 * Live carrier rate: the browser sends only ids. The rate is re-fetched from
 * Shippo by id and its shipment checked against this order's parcel before
 * Stripe sees the amount. Shippo errors fall back to flat shipping.
 */
async function lookupLiveRate(store: ShopStore, body: { shipping?: { rateId?: unknown; shipmentId?: unknown } }, parcel: Parcel | null): Promise<RateLookup> {
  const rateId = cleanStr(body.shipping?.rateId);
  const shipmentId = cleanStr(body.shipping?.shipmentId);
  if (!rateId || !shipmentId) return { rate: null, invalid: false };
  const cfg = shippoConfig();
  const from = shipFromAddress(store.settings);
  if (!cfg || !from || !parcel) return { rate: null, invalid: false };
  let rateRaw: unknown = null;
  let shipment: unknown = null;
  try {
    [rateRaw, shipment] = await Promise.all([retrieveRate(cfg, rateId), retrieveShipment(cfg, shipmentId)]);
  } catch (err) {
    console.error("live rate re-check failed:", err instanceof Error ? err.message : err);
    return { rate: null, invalid: false };
  }
  const check = checkCartRate(rateRaw, shipment, shipmentId, parcel, from.address);
  return check.ok ? { rate: check.rate, invalid: false } : { rate: null, invalid: true };
}

const rateChanged = () =>
  NextResponse.json(
    { error: "Shipping rates changed. Please get rates again.", code: "rate_invalid" },
    { status: 409 },
  );

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const store = await readStore();

    if (body.sign) {
      const quote = estimateSign(store.metalSigns, body.sign.widthIn, body.sign.heightIn, {
        finishId: cleanStr(body.sign.finishId),
        fulfillment: body.sign.pickup === true || body.sign.fulfillment === "pickup" ? "pickup" : "ship",
      });
      if (!quote.ok) {
        return NextResponse.json({ error: quote.error }, { status: 400 });
      }
      const live =
        quote.fulfillment === "ship"
          ? await lookupLiveRate(store, body, signParcel(store.metalSigns, quote.widthIn, quote.heightIn))
          : { rate: null, invalid: false };
      if (live.invalid) return rateChanged();
      const session = await createSignCheckoutSession(
        store,
        quote,
        cleanStr(body.email) || undefined,
        live.rate,
      );
      return NextResponse.json({ url: session.url });
    }

    const items = resolveCartItems(store, body.items);

    if (!items.length) {
      return NextResponse.json({ error: "Cart is empty or those parts are hidden." }, { status: 400 });
    }

    const live = await lookupLiveRate(store, body, buildParcel(items, store.settings));
    if (live.invalid) return rateChanged();

    const session = await createCheckoutSession(store, items, cleanStr(body.email) || undefined, live.rate);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
