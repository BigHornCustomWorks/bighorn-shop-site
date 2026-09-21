import { formatUsd } from "./money";
import type { MetalSignsConfig, SignFinish, SignUnit } from "./types";

export type SignFulfillment = "pickup" | "ship";

export type SignQuote =
  | {
      ok: true;
      cents: number;
      finishCents: number;
      shippingCents: number;
      totalCents: number;
      widthIn: number;
      heightIn: number;
      area: number;
      areaLabel: string;
      rateLabel: string;
      shippingLabel: string;
      finishName: string;
      fulfillment: SignFulfillment;
      name: string;
      description: string;
      minApplied: boolean;
    }
  | { ok: false; error: string };

export type SignEstimateOpts = {
  finishId?: string;
  fulfillment?: SignFulfillment;
};

export function asInch(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.max(0, n) * 100) / 100;
}

export function inchLabel(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function unitLabel(unit: SignUnit): string {
  return unit === "sqin" ? "sq in" : "sq ft";
}

export function signArea(widthIn: number, heightIn: number, unit: SignUnit): number {
  const sqin = Math.max(0, widthIn) * Math.max(0, heightIn);
  return unit === "sqft" ? sqin / 144 : sqin;
}

/** Postage from finished size. Larger signs cost more to ship. */
export function signShippingCents(cfg: MetalSignsConfig, widthIn: number, heightIn: number): number {
  const sqft = (Math.max(0, widthIn) * Math.max(0, heightIn)) / 144;
  const base = cfg.shippingBaseCents || 0;
  const per = cfg.shippingPerSqFtCents || 0;
  if (base <= 0 && per <= 0) return cfg.shippingCents || 0;
  let cents = base + Math.round(sqft * per);
  if (cfg.shippingMaxCents > 0) cents = Math.min(cents, cfg.shippingMaxCents);
  return Math.max(0, cents);
}

export function visibleFinishes(cfg: MetalSignsConfig): SignFinish[] {
  return (cfg.finishes || []).filter((f) => f.visible && f.name);
}

export function finishExtraCents(finish: SignFinish | undefined, widthIn: number, heightIn: number): number {
  if (!finish || finish.extraCents <= 0) return 0;
  if (finish.extraKind === "flat") return finish.extraCents;
  const sqft = (Math.max(0, widthIn) * Math.max(0, heightIn)) / 144;
  return Math.round(sqft * finish.extraCents);
}

export function estimateSign(
  cfg: MetalSignsConfig,
  widthRaw: unknown,
  heightRaw: unknown,
  opts: SignEstimateOpts = {},
): SignQuote {
  if (!cfg.visible) {
    return { ok: false, error: "Metal signs are not listed right now." };
  }
  if (cfg.rateCents <= 0) {
    return { ok: false, error: "A rate is not posted yet. Request a quote." };
  }

  const widthIn = asInch(widthRaw);
  const heightIn = asInch(heightRaw);
  if (widthIn <= 0 || heightIn <= 0) {
    return { ok: false, error: "Enter width and height in inches." };
  }
  if (widthIn < cfg.minWidthIn || heightIn < cfg.minHeightIn) {
    return {
      ok: false,
      error: `Minimum size is ${inchLabel(cfg.minWidthIn)} × ${inchLabel(cfg.minHeightIn)} in.`,
    };
  }
  if (widthIn > cfg.maxWidthIn || heightIn > cfg.maxHeightIn) {
    return {
      ok: false,
      error: `Maximum size is ${inchLabel(cfg.maxWidthIn)} × ${inchLabel(cfg.maxHeightIn)} in.`,
    };
  }

  const area = signArea(widthIn, heightIn, cfg.unit);
  const unit = unitLabel(cfg.unit);
  let cents = Math.round(area * cfg.rateCents);
  const minApplied = cfg.minCents > 0 && cents < cfg.minCents;
  if (minApplied) cents = cfg.minCents;

  const finish = visibleFinishes(cfg).find((f) => f.id === opts.finishId) || visibleFinishes(cfg)[0];
  const finishCents = finishExtraCents(finish, widthIn, heightIn);
  cents += finishCents;

  if (cents < 50) {
    return { ok: false, error: "That size is too small to check out. Request a quote." };
  }

  const fulfillment: SignFulfillment = opts.fulfillment === "pickup" ? "pickup" : "ship";
  const ship = fulfillment === "pickup" ? 0 : signShippingCents(cfg, widthIn, heightIn);
  const areaLabel = `${area.toFixed(cfg.unit === "sqft" ? 3 : 1)} ${unit}`;
  const rateLabel = `${formatUsd(cfg.rateCents)} / ${unit}`;
  const size = `${inchLabel(widthIn)} × ${inchLabel(heightIn)} in`;
  const minNote = minApplied ? ` Minimum charge ${formatUsd(cfg.minCents)} applied.` : "";
  const finishName = finish?.name || "Bare metal";
  const shippingLabel =
    fulfillment === "pickup"
      ? "Local pickup — no shipping"
      : ship > 0
        ? `Shipping ${formatUsd(ship)}`
        : "Shipping at checkout";

  return {
    ok: true,
    cents,
    finishCents,
    shippingCents: ship,
    totalCents: cents + ship,
    widthIn,
    heightIn,
    area,
    areaLabel,
    rateLabel,
    shippingLabel,
    finishName,
    fulfillment,
    name: `Custom metal sign (${size}${finishName ? `, ${finishName}` : ""})`,
    description: `${areaLabel} at ${rateLabel}. ${finishName}${finishCents ? ` + ${formatUsd(finishCents)}` : ""}.${minNote}`.slice(0, 400),
    minApplied,
  };
}
