import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { cleanStr } from "@/lib/sanitize";
import {
  ShippoError,
  planLabel,
  shipFromAddress,
  shippoConfig,
  type LabelResult,
} from "@/lib/shipping";
import { readStore, writeStore } from "@/lib/store";
import type { ShopOrder } from "@/lib/types";

export const runtime = "nodejs";

/** A second click inside this window is refused while the first is still buying. */
const BUYING_LOCK_MS = 2 * 60 * 1000;

function labelFields(label: LabelResult): Partial<ShopOrder> {
  const carrierId = label.carrier.toLowerCase();
  return {
    labelStatus: "bought",
    labelError: "",
    labelRateId: label.rateId,
    labelUrl: label.labelUrl,
    labelTrackingUrl: label.trackingUrl,
    labelCarrier: label.carrier,
    labelService: label.service,
    labelCents: label.cents,
    labelBoughtAt: new Date().toISOString(),
    // Prefill the existing tracking fields so "Mark shipped & email tracking"
    // works with one click. Nothing is emailed from here.
    trackingNumber: label.trackingNumber,
    trackingCarrier: carrierId === "usps" || carrierId === "ups" ? carrierId : "other",
  };
}

/** Re-read the store right before writing so we only touch this one order. */
async function patchOrder(orderId: string, fields: Partial<ShopOrder>) {
  const store = await readStore();
  const order = store.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, order: null };
  Object.assign(order, fields);
  const result = await writeStore(store);
  return { ok: result.ok, order };
}

/**
 * Buys the carrier label for a paid order that used a live rate.
 *
 * POST { orderId }                                  → buy the checkout rate, or
 *                                                     answer needsConfirm with a re-rate
 * POST { orderId, confirm: { shipmentId, rateId } } → buy the re-rated quote
 *
 * Double purchase is guarded three ways: a saved label is returned as-is, a
 * "buying" lock refuses overlapping clicks, and planLabel asks Shippo for an
 * existing successful label on every rate tied to the order before buying.
 */
export async function POST(req: Request) {
  if (!(await isMaster())) return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const orderId = cleanStr(body.orderId);
  const confirm =
    body.confirm && cleanStr(body.confirm.shipmentId) && cleanStr(body.confirm.rateId)
      ? { shipmentId: cleanStr(body.confirm.shipmentId), rateId: cleanStr(body.confirm.rateId) }
      : undefined;

  const cfg = shippoConfig();
  if (!cfg) {
    return NextResponse.json({ error: "SHIPPO_API_KEY is not set, so labels cannot be bought here." }, { status: 400 });
  }

  const store = await readStore();
  const from = shipFromAddress(store.settings);
  if (!from) {
    return NextResponse.json({ error: "Add the ship-from address in Settings first." }, { status: 400 });
  }
  const order = store.orders.find((o) => o.id === orderId);
  if (!order) return NextResponse.json({ error: "That order is not in the list." }, { status: 404 });
  if (order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "Only paid orders can get a label." }, { status: 400 });
  }
  if (!order.rateId || !order.rateShipmentId) {
    return NextResponse.json({ error: "This order did not use a live rate." }, { status: 400 });
  }
  if (order.labelUrl) {
    return NextResponse.json({ ok: true, already: true, order: pickLabel(order) });
  }
  const startedAt = Date.parse(order.labelStartedAt || "");
  if (order.labelStatus === "buying" && Number.isFinite(startedAt) && Date.now() - startedAt < BUYING_LOCK_MS) {
    return NextResponse.json({ error: "A label is already being bought for this order. Wait a minute and refresh." }, { status: 409 });
  }

  await patchOrder(order.id, { labelStatus: "buying", labelStartedAt: new Date().toISOString(), labelError: "" });

  try {
    const outcome = await planLabel(cfg, order, from.address, confirm);

    if (outcome.kind === "bought" || outcome.kind === "already") {
      const saved = await patchOrder(order.id, labelFields(outcome.label));
      return NextResponse.json({
        ok: true,
        already: outcome.kind === "already",
        order: saved.order ? pickLabel(saved.order) : null,
        storageWarning: saved.ok ? "" : "Label bought but not saved durably. Copy the tracking number now.",
        label: outcome.label,
      });
    }

    if (outcome.kind === "confirm") {
      await patchOrder(order.id, { labelStatus: "", labelRateId: outcome.rateId });
      return NextResponse.json({ ok: false, needsConfirm: true, quote: outcome });
    }

    await patchOrder(order.id, { labelStatus: "error", labelError: outcome.message });
    return NextResponse.json({ error: outcome.message }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof ShippoError ? `Shippo: ${err.message}` : err instanceof Error ? err.message : "Label failed.";
    await patchOrder(order.id, { labelStatus: "error", labelError: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function pickLabel(o: ShopOrder): Partial<ShopOrder> {
  return {
    labelStatus: o.labelStatus,
    labelError: o.labelError,
    labelRateId: o.labelRateId,
    labelUrl: o.labelUrl,
    labelTrackingUrl: o.labelTrackingUrl,
    labelCarrier: o.labelCarrier,
    labelService: o.labelService,
    labelCents: o.labelCents,
    labelBoughtAt: o.labelBoughtAt,
    trackingNumber: o.trackingNumber,
    trackingCarrier: o.trackingCarrier,
  };
}
