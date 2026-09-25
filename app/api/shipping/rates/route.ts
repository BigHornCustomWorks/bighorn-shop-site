import { NextResponse } from "next/server";
import { resolveCartItems } from "@/lib/cart-items";
import { cleanStr } from "@/lib/sanitize";
import {
  buildParcel,
  normalizeShipAddress,
  quoteRates,
  shipFromAddress,
  shippoConfig,
  signParcel,
  zip5,
  type Parcel,
} from "@/lib/shipping";
import { estimateSign } from "@/lib/sign-price";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Live USPS/UPS rates for the cart or a custom sign, via Shippo.
 *
 * Body: { items: [...] } for the cart, or { sign: { widthIn, heightIn } } for
 * the sign estimator, plus an optional { address: { zip, street1?, city?, state? } }.
 *
 * Every "can't do live rates" case answers 200 with mode "flat" and a reason,
 * never an error, so the cart simply carries on to the existing flat/per-item
 * shipping on the Stripe page. A POST without an address is a cheap probe the
 * cart uses to decide whether to show the ZIP box at all.
 *
 *   mode "none"  — nothing in the cart ships (digital only)
 *   mode "flat"  — live rates unavailable; reason says why
 *   mode "ready" — live rates available, send an address
 *   mode "live"  — here are the rates
 */

// Light per-instance throttle: each lookup creates a Shippo shipment.
const hits = new Map<string, number[]>();
function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const store = await readStore();
  const pickup = store.site.pickupEnabled !== false;

  let parcel: Parcel | null;
  if (body.sign) {
    const quote = estimateSign(store.metalSigns, body.sign.widthIn, body.sign.heightIn, {
      finishId: cleanStr(body.sign.finishId),
    });
    if (!quote.ok) return NextResponse.json({ mode: "flat", reason: "no_quote", pickup });
    parcel = signParcel(store.metalSigns, quote.widthIn, quote.heightIn);
  } else {
    const items = resolveCartItems(store, body.items);
    if (!items.some((i) => i.product.kind !== "digital")) {
      return NextResponse.json({ mode: "none", pickup });
    }
    parcel = buildParcel(items, store.settings);
  }

  const cfg = shippoConfig();
  if (!cfg) return NextResponse.json({ mode: "flat", reason: "not_configured", pickup });
  const from = shipFromAddress(store.settings);
  if (!from) return NextResponse.json({ mode: "flat", reason: "no_ship_from", pickup });
  if (!parcel) return NextResponse.json({ mode: "flat", reason: "missing_dimensions", pickup });

  if (!body.address) return NextResponse.json({ mode: "ready", pickup });

  const to = normalizeShipAddress(body.address);
  if (!zip5(to.zip)) {
    return NextResponse.json({ error: "Enter a 5-digit US ZIP code." }, { status: 400 });
  }
  to.zip = zip5(to.zip);
  to.country = "US";

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (throttled(ip)) {
    return NextResponse.json({ mode: "flat", reason: "busy", pickup });
  }

  try {
    const quote = await quoteRates(cfg, from.address, to, parcel);
    if (!quote.shipmentId || !quote.rates.length) {
      return NextResponse.json({ mode: "flat", reason: "no_rates", pickup });
    }
    return NextResponse.json({
      mode: "live",
      pickup,
      shipmentId: quote.shipmentId,
      rates: quote.rates.map((r) => ({
        id: r.id,
        carrier: r.carrier,
        service: r.service,
        displayName: r.displayName,
        amountCents: r.amountCents,
        days: r.days,
      })),
    });
  } catch (err) {
    console.error("live rates failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ mode: "flat", reason: "api_error", pickup });
  }
}
