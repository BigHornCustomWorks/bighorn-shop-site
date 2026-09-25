/**
 * Live carrier rates and label purchase through Shippo's REST API.
 *
 * This file deliberately has no runtime imports (only `import type`), so the
 * unit tests in tests/shipping.test.mjs can load it straight into Node with a
 * mocked fetch. Everything that talks to Shippo takes a config object with an
 * optional fetchImpl for the same reason.
 *
 * Money from Shippo arrives as dollar strings ("11.01"); everything here is
 * converted to integer cents before it goes anywhere near Stripe.
 */
import type {
  MetalSignsConfig,
  PackagePreset,
  Product,
  ShipAddress,
  ShopSettings,
  SignPackConfig,
} from "./types";

export const SHIPPO_BASE = "https://api.goshippo.com";

/** Carriers the storefront offers. Shippo may return others (FedEx etc.). */
export const LIVE_CARRIERS = ["USPS", "UPS"];

/** Shippo only sells labels on rates younger than 7 days; re-rate a bit sooner. */
export const RATE_MAX_AGE_MS = 6.5 * 24 * 60 * 60 * 1000;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type ShippoConfig = {
  apiKey: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

export type Parcel = {
  length: number;
  width: number;
  height: number;
  /** Ounces. */
  weight: number;
};

export type LiveRate = {
  id: string;
  shipmentId: string;
  carrier: string;
  /** Shippo service level name, e.g. "Ground Advantage". */
  service: string;
  /** Shippo service level token, e.g. "usps_ground_advantage". */
  serviceToken: string;
  /** "USPS Ground Advantage" — goes on the Stripe payment page and the order. */
  displayName: string;
  amountCents: number;
  /** Business days, or 0 when the carrier gave no estimate. */
  days: number;
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function plain(value: unknown, max = 120): string {
  if (value == null) return "";
  return String(value)
    .replace(/<\/?[^>]+>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

/** Positive finite number (decimals kept), else 0. */
export function measure(value: unknown, max = 100000): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n) || n <= 0 || n > max) return 0;
  return Math.round(n * 10000) / 10000;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Addresses                                                           */
/* ------------------------------------------------------------------ */

const ADDRESS_FIELDS = [
  "name",
  "company",
  "street1",
  "street2",
  "city",
  "state",
  "zip",
  "country",
  "phone",
  "email",
] as const;

export function emptyShipAddress(): ShipAddress {
  return {
    name: "",
    company: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    phone: "",
    email: "",
  };
}

export function normalizeShipAddress(raw: unknown): ShipAddress {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = emptyShipAddress();
  for (const key of ADDRESS_FIELDS) out[key] = plain(src[key]);
  out.state = out.state.toUpperCase().slice(0, 2);
  out.country = (out.country || "").toUpperCase().slice(0, 2);
  return out;
}

export function zip5(zip: unknown): string {
  const m = String(zip ?? "").match(/^\s*(\d{5})/);
  return m ? m[1] : "";
}

/** Enough for a carrier to rate and print a label. */
export function addressComplete(a: ShipAddress | null | undefined): boolean {
  return Boolean(a && a.street1 && a.city && a.state && zip5(a.zip));
}

type Env = Record<string, string | undefined>;

function envAddress(env: Env): ShipAddress {
  return normalizeShipAddress({
    name: env.SHIP_FROM_NAME,
    company: env.SHIP_FROM_COMPANY,
    street1: env.SHIP_FROM_STREET1,
    street2: env.SHIP_FROM_STREET2,
    city: env.SHIP_FROM_CITY,
    state: env.SHIP_FROM_STATE,
    zip: env.SHIP_FROM_ZIP,
    country: env.SHIP_FROM_COUNTRY || "US",
    phone: env.SHIP_FROM_PHONE,
    email: env.SHIP_FROM_EMAIL,
  });
}

/**
 * The business ship-from address. A complete address saved in Master Control
 * wins; otherwise the SHIP_FROM_* env vars. There is deliberately no built-in
 * default — returning null keeps live rates off until Clint supplies one.
 */
export function shipFromAddress(
  settings: Pick<ShopSettings, "shipFrom"> | null | undefined,
  env: Env = process.env,
): { address: ShipAddress; source: "settings" | "env" } | null {
  const saved = normalizeShipAddress(settings?.shipFrom);
  if (addressComplete(saved)) {
    return { address: { ...saved, country: saved.country || "US" }, source: "settings" };
  }
  const fromEnv = envAddress(env);
  if (addressComplete(fromEnv)) return { address: fromEnv, source: "env" };
  return null;
}

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

export function shippoKey(env: Env = process.env): string {
  return plain(env.SHIPPO_API_KEY, 200);
}

/** Shippo test tokens start shippo_test_, live tokens shippo_live_. */
export function shippoKeyMode(key: string): "test" | "live" | "unknown" | "" {
  if (!key) return "";
  if (key.startsWith("shippo_test_")) return "test";
  if (key.startsWith("shippo_live_")) return "live";
  return "unknown";
}

export function shippoConfig(env: Env = process.env, fetchImpl?: FetchLike): ShippoConfig | null {
  const apiKey = shippoKey(env);
  return apiKey ? { apiKey, fetchImpl } : null;
}

/* ------------------------------------------------------------------ */
/* Package presets and product parcels                                 */
/* ------------------------------------------------------------------ */

export const DEFAULT_PACKAGING_ALLOWANCE_OZ = 2;

export function normalizePreset(raw: unknown, i: number): PackagePreset | null {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = plain(src.name, 60);
  if (!name) return null;
  return {
    id: plain(src.id, 60) || `box${i + 1}`,
    name,
    lengthIn: measure(src.lengthIn, 120),
    widthIn: measure(src.widthIn, 120),
    heightIn: measure(src.heightIn, 120),
    emptyWeightOz: measure(src.emptyWeightOz, 800),
  };
}

type BoxProduct = Pick<
  Product,
  "kind" | "weightOz" | "packagePresetId" | "lengthIn" | "widthIn" | "heightIn" | "boxWeightOz"
>;

export type Box = { length: number; width: number; height: number; emptyOz: number; source: "override" | "preset" };

/**
 * The box a product ships in: its own override dimensions when all three are
 * filled in (with boxWeightOz as that box's empty weight), else its preset.
 */
export function productBox(product: BoxProduct, presets: PackagePreset[]): Box | null {
  if (product.lengthIn > 0 && product.widthIn > 0 && product.heightIn > 0) {
    return {
      length: product.lengthIn,
      width: product.widthIn,
      height: product.heightIn,
      emptyOz: Math.max(0, product.boxWeightOz || 0),
      source: "override",
    };
  }
  const preset = presets.find((p) => p.id === product.packagePresetId);
  if (preset && preset.lengthIn > 0 && preset.widthIn > 0 && preset.heightIn > 0) {
    return {
      length: preset.lengthIn,
      width: preset.widthIn,
      height: preset.heightIn,
      emptyOz: preset.emptyWeightOz,
      source: "preset",
    };
  }
  return null;
}

export function productMeasured(product: BoxProduct, presets: PackagePreset[]): boolean {
  return product.weightOz > 0 && Boolean(productBox(product, presets));
}

type ParcelItem = { product: BoxProduct; quantity: number };

/**
 * One parcel for the whole cart.
 *
 * Single unit: that item's box; weight = item + empty box + packaging allowance.
 * Several units: boxes stacked (longest L, widest W, heights added) and every
 * unit's item + box weight counted, plus the allowance once. Conservative on
 * purpose — it slightly over-estimates rather than under-charging. It is
 * reproducible, which checkout relies on to validate the customer's rate.
 *
 * Returns null (→ flat shipping) when nothing ships or any physical item is
 * missing its item weight or a box.
 */
export function buildParcel(
  items: ParcelItem[],
  settings: Pick<ShopSettings, "packagePresets" | "packagingAllowanceOz">,
): Parcel | null {
  const presets = settings.packagePresets || [];
  const physical = items.filter((i) => i.product.kind !== "digital");
  if (!physical.length) return null;
  let weight = 0;
  let length = 0;
  let width = 0;
  let height = 0;
  for (const { product, quantity } of physical) {
    const box = product.weightOz > 0 ? productBox(product, presets) : null;
    if (!box) return null;
    const qty = Math.max(1, Math.min(Math.round(quantity) || 1, 20));
    weight += (product.weightOz + box.emptyOz) * qty;
    length = Math.max(length, box.length);
    width = Math.max(width, box.width);
    height += box.height * qty;
  }
  weight += Math.max(0, settings.packagingAllowanceOz || 0);
  return { length: round1(length), width: round1(width), height: round1(height), weight: round1(weight) };
}

/* ------------------------------------------------------------------ */
/* Signs                                                               */
/* ------------------------------------------------------------------ */

export function defaultSignPack(): SignPackConfig {
  return {
    material: "steel",
    steelDensityLbPerIn3: 0.284,
    aluminumDensityLbPerIn3: 0.0975,
    // 20 ga, 18 ga, 16 ga, 14 ga steel; 0.063 / 0.080 / 0.125 aluminum.
    thicknessOptionsIn: [0.036, 0.048, 0.06, 0.063, 0.075, 0.08, 0.125],
    thicknessIn: 0.048,
    marginIn: 2,
    depthIn: 1,
    cardboardOzPerSqFt: 1.2,
    allowanceOz: 4,
  };
}

export function normalizeSignPack(raw: unknown): SignPackConfig {
  const base = defaultSignPack();
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const options = (Array.isArray(src.thicknessOptionsIn) ? src.thicknessOptionsIn : [])
    .map((t) => measure(t, 2))
    .filter((t) => t > 0);
  const thicknessOptionsIn = [...new Set(options.length ? options : base.thicknessOptionsIn)]
    .sort((a, b) => a - b)
    .slice(0, 20);
  const thickness = measure(src.thicknessIn, 2);
  const num = (v: unknown, fallback: number, max: number, allowZero = false) => {
    if (allowZero && Number(v) === 0 && v !== "" && v != null) return 0;
    return measure(v, max) || fallback;
  };
  return {
    material: src.material === "aluminum" ? "aluminum" : "steel",
    steelDensityLbPerIn3: num(src.steelDensityLbPerIn3, base.steelDensityLbPerIn3, 1),
    aluminumDensityLbPerIn3: num(src.aluminumDensityLbPerIn3, base.aluminumDensityLbPerIn3, 1),
    thicknessOptionsIn,
    thicknessIn: thickness && thicknessOptionsIn.includes(thickness) ? thickness : thicknessOptionsIn.includes(base.thicknessIn) ? base.thicknessIn : thicknessOptionsIn[0],
    marginIn: num(src.marginIn, base.marginIn, 24, true),
    depthIn: num(src.depthIn, base.depthIn, 12),
    cardboardOzPerSqFt: num(src.cardboardOzPerSqFt, base.cardboardOzPerSqFt, 50, true),
    allowanceOz: num(src.allowanceOz, base.allowanceOz, 800, true),
  };
}

/** Sign metal weight in ounces: width × height × thickness × density. */
export function signMetalOz(pack: SignPackConfig, widthIn: number, heightIn: number): number {
  const density = pack.material === "aluminum" ? pack.aluminumDensityLbPerIn3 : pack.steelDensityLbPerIn3;
  return widthIn * heightIn * pack.thicknessIn * density * 16;
}

/**
 * Flat pack for a custom sign: sign size plus the margin on every side, a
 * thin configurable depth; weight = metal + cardboard (both faces of the
 * pack) + packaging allowance.
 */
export function signParcel(cfg: Pick<MetalSignsConfig, "pack">, widthIn: number, heightIn: number): Parcel | null {
  const pack = cfg.pack || defaultSignPack();
  if (!(widthIn > 0 && heightIn > 0) || !(pack.thicknessIn > 0)) return null;
  const long = Math.max(widthIn, heightIn) + 2 * pack.marginIn;
  const short = Math.min(widthIn, heightIn) + 2 * pack.marginIn;
  const faceSqFt = (long * short) / 144;
  const weight = signMetalOz(pack, widthIn, heightIn) + faceSqFt * 2 * pack.cardboardOzPerSqFt + pack.allowanceOz;
  return { length: round1(long), width: round1(short), height: round1(pack.depthIn), weight: round1(weight) };
}

export function parcelMatches(a: unknown, b: Parcel): boolean {
  if (!a || typeof a !== "object") return false;
  const p = a as Record<string, unknown>;
  if (p.mass_unit && p.mass_unit !== "oz") return false;
  if (p.distance_unit && p.distance_unit !== "in") return false;
  const close = (x: unknown, y: number) => Math.abs(Number(x) - y) < 0.05;
  return close(p.length, b.length) && close(p.width, b.width) && close(p.height, b.height) && close(p.weight, b.weight);
}

/* ------------------------------------------------------------------ */
/* Shippo HTTP                                                         */
/* ------------------------------------------------------------------ */

export class ShippoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ShippoError";
    this.status = status;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

function errorText(json: Json, status: number): string {
  if (json && typeof json === "object") {
    if (typeof json.detail === "string") return plain(json.detail, 300);
    const parts: string[] = [];
    for (const [k, v] of Object.entries(json)) {
      if (Array.isArray(v)) parts.push(`${k}: ${v.map((x) => plain(typeof x === "string" ? x : JSON.stringify(x), 120)).join(", ")}`);
      else if (typeof v === "string") parts.push(`${k}: ${plain(v, 120)}`);
    }
    if (parts.length) return parts.join("; ").slice(0, 300);
  }
  return `Shippo HTTP ${status}`;
}

async function shippo(cfg: ShippoConfig, method: "GET" | "POST", path: string, body?: unknown): Promise<Json> {
  const doFetch = cfg.fetchImpl || fetch;
  const res = await doFetch(`${SHIPPO_BASE}${path}`, {
    method,
    headers: { Authorization: `ShippoToken ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(cfg.timeoutMs || 20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ShippoError(errorText(json, res.status), res.status);
  return json;
}

function shippoAddress(a: ShipAddress): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ADDRESS_FIELDS) if (a[key]) out[key] = a[key];
  out.country = a.country || "US";
  return out;
}

function shippoParcel(p: Parcel) {
  return {
    length: String(p.length),
    width: String(p.width),
    height: String(p.height),
    distance_unit: "in",
    weight: String(p.weight),
    mass_unit: "oz",
  };
}

export function toCents(amount: unknown): number {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

function cleanServiceName(name: string, carrier: string): string {
  let out = plain(name).replace(/[®™]/g, "").replace(/\s+/g, " ").trim();
  if (out.toUpperCase().startsWith(`${carrier} `)) out = out.slice(carrier.length + 1);
  return out;
}

export function toLiveRate(raw: Json, shipmentId = ""): LiveRate | null {
  if (!raw || typeof raw !== "object") return null;
  const carrier = plain(raw.provider).toUpperCase();
  const level = raw.servicelevel && typeof raw.servicelevel === "object" ? raw.servicelevel : {};
  const service = cleanServiceName(level.name || raw.servicelevel_name || "", carrier);
  const serviceToken = plain(level.token || raw.servicelevel_token || "");
  const amountCents = toCents(raw.amount);
  const currency = plain(raw.currency || "USD").toUpperCase();
  if (!raw.object_id || !carrier || !service || !amountCents || currency !== "USD") return null;
  const days = Number(raw.estimated_days ?? raw.days);
  return {
    id: plain(raw.object_id),
    shipmentId: plain(raw.shipment) || shipmentId,
    carrier,
    service,
    serviceToken,
    displayName: `${carrier} ${service}`.slice(0, 100),
    amountCents,
    days: Number.isFinite(days) && days > 0 ? Math.round(days) : 0,
    createdAt: plain(raw.object_created),
  };
}

/** USPS and UPS only, cheapest first. */
export function offeredRates(rates: Json[], shipmentId = ""): LiveRate[] {
  return (Array.isArray(rates) ? rates : [])
    .map((r) => toLiveRate(r, shipmentId))
    .filter((r): r is LiveRate => Boolean(r) && LIVE_CARRIERS.includes((r as LiveRate).carrier))
    .sort((a, b) => a.amountCents - b.amountCents);
}

export function createShipment(
  cfg: ShippoConfig,
  from: ShipAddress,
  to: ShipAddress,
  parcel: Parcel,
  metadata?: string,
): Promise<Json> {
  return shippo(cfg, "POST", "/shipments/", {
    address_from: shippoAddress(from),
    address_to: shippoAddress(to),
    parcels: [shippoParcel(parcel)],
    async: false,
    metadata: metadata ? metadata.slice(0, 100) : undefined,
  });
}

export function retrieveShipment(cfg: ShippoConfig, id: string): Promise<Json> {
  return shippo(cfg, "GET", `/shipments/${encodeURIComponent(id)}`);
}

export function retrieveRate(cfg: ShippoConfig, id: string): Promise<Json> {
  return shippo(cfg, "GET", `/rates/${encodeURIComponent(id)}`);
}

export async function transactionsForRate(cfg: ShippoConfig, rateId: string): Promise<Json[]> {
  const json = await shippo(cfg, "GET", `/transactions/?rate=${encodeURIComponent(rateId)}&results=25`);
  return Array.isArray(json?.results) ? json.results : [];
}

export function buyRate(cfg: ShippoConfig, rateId: string, metadata: string): Promise<Json> {
  return shippo(cfg, "POST", "/transactions/", {
    rate: rateId,
    label_file_type: "PDF_4x6",
    async: false,
    metadata: metadata.slice(0, 100),
  });
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

export async function quoteRates(
  cfg: ShippoConfig,
  from: ShipAddress,
  to: ShipAddress,
  parcel: Parcel,
): Promise<{ shipmentId: string; rates: LiveRate[] }> {
  const shipment = await createShipment(cfg, from, { ...to, country: "US" }, parcel);
  const shipmentId = plain(shipment?.object_id);
  return { shipmentId, rates: shipmentId ? offeredRates(shipment.rates, shipmentId) : [] };
}

export type RateCheck = { ok: true; rate: LiveRate } | { ok: false; reason: string };

/**
 * Server-side check of a rate the browser says the customer picked. The
 * browser only sends ids; the amount always comes from Shippo (the rate is
 * re-fetched by id), and its shipment has to be for this exact parcel from our
 * ship-from ZIP, so a rate quoted for a lighter box cannot be replayed.
 */
export function checkCartRate(
  rateRaw: Json,
  shipment: Json,
  shipmentId: string,
  parcel: Parcel,
  from: ShipAddress,
  now = Date.now(),
): RateCheck {
  const rate = toLiveRate(rateRaw, shipmentId);
  if (!rate) return { ok: false, reason: "rate not found" };
  if (!LIVE_CARRIERS.includes(rate.carrier)) return { ok: false, reason: "rate not offered" };
  if (rate.shipmentId !== shipmentId) return { ok: false, reason: "rate is for another shipment" };
  if (!shipment || plain(shipment.object_id) !== shipmentId) return { ok: false, reason: "shipment not found" };
  const parcels = Array.isArray(shipment.parcels) ? shipment.parcels : [];
  if (parcels.length !== 1 || !parcelMatches(parcels[0], parcel)) {
    return { ok: false, reason: "cart changed since rates were quoted" };
  }
  if (zip5(shipment.address_from?.zip) !== zip5(from.zip)) return { ok: false, reason: "ship-from changed" };
  const created = Date.parse(rate.createdAt || "");
  if (Number.isFinite(created) && now - created > RATE_MAX_AGE_MS) return { ok: false, reason: "rate expired" };
  return { ok: true, rate };
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export type LabelResult = {
  rateId: string;
  labelUrl: string;
  trackingNumber: string;
  trackingUrl: string;
  carrier: string;
  service: string;
  cents: number;
};

function labelFromTransaction(tx: Json, rate: LiveRate | null): LabelResult | null {
  if (!tx || tx.status !== "SUCCESS" || !tx.label_url) return null;
  return {
    rateId: plain(typeof tx.rate === "string" ? tx.rate : tx.rate?.object_id) || rate?.id || "",
    labelUrl: plain(tx.label_url, 1000),
    trackingNumber: plain(tx.tracking_number),
    trackingUrl: plain(tx.tracking_url_provider, 1000),
    carrier: rate?.carrier || "",
    service: rate?.service || "",
    cents: rate?.amountCents || 0,
  };
}

function messagesText(tx: Json): string {
  const msgs = Array.isArray(tx?.messages) ? tx.messages : [];
  return msgs.map((m: Json) => plain(m?.text, 200)).filter(Boolean).join(" ").slice(0, 400);
}

function streetKey(s: unknown): string {
  return plain(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Same street line and ZIP — enough to trust a quote was for this door. */
export function sameDestination(shippoTo: Json, to: ShipAddress): boolean {
  if (!shippoTo || !to.street1) return false;
  return streetKey(shippoTo.street1) === streetKey(to.street1) && zip5(shippoTo.zip) === zip5(to.zip);
}

export type LabelOrder = {
  id: string;
  shipTo: ShipAddress;
  rateId: string;
  rateShipmentId: string;
  rateCarrier: string;
  rateService: string;
  rateServiceToken: string;
  rateCents: number;
  labelRateId: string;
};

export type LabelOutcome =
  | { kind: "bought"; label: LabelResult }
  | { kind: "already"; label: LabelResult }
  | {
      kind: "confirm";
      shipmentId: string;
      rateId: string;
      carrier: string;
      service: string;
      oldCents: number;
      newCents: number;
      sameService: boolean;
      reason: string;
    }
  | { kind: "error"; message: string };

export function labelReference(orderId: string): string {
  return `bhcw-${orderId}`;
}

function confirmFrom(order: LabelOrder, shipmentId: string, rates: LiveRate[], reason: string): LabelOutcome {
  const carrier = order.rateCarrier.toUpperCase();
  const exact = rates.find(
    (r) => r.carrier === carrier && (order.rateServiceToken ? r.serviceToken === order.rateServiceToken : r.service === order.rateService),
  );
  const sameCarrier = rates.filter((r) => r.carrier === carrier);
  const pick = exact || sameCarrier[0] || rates[0];
  if (!pick) return { kind: "error", message: "No USPS or UPS rates came back for this address. Buy this one by hand." };
  return {
    kind: "confirm",
    shipmentId,
    rateId: pick.id,
    carrier: pick.carrier,
    service: pick.service,
    oldCents: order.rateCents,
    newCents: pick.amountCents,
    sameService: Boolean(exact),
    reason,
  };
}

async function buyOnce(cfg: ShippoConfig, order: LabelOrder, rate: LiveRate): Promise<LabelOutcome> {
  const tx = await buyRate(cfg, rate.id, `${labelReference(order.id)} ${rate.displayName}`);
  const label = labelFromTransaction(tx, rate);
  if (label) return { kind: "bought", label };
  if (tx?.status === "QUEUED" || tx?.status === "WAITING") {
    return { kind: "error", message: "Shippo is still making this label. Wait a minute, then click again — it will not buy twice." };
  }
  return { kind: "error", message: `Shippo could not make the label: ${messagesText(tx) || tx?.status || "unknown error"}` };
}

/**
 * Decide and, when safe, buy the label for a paid order.
 *
 * - If any rate tied to this order already has a successful Shippo
 *   transaction, return that label instead of buying again.
 * - If the checkout quote was for the full delivery address and is under
 *   ~7 days old (Shippo's limit), buy that exact rate.
 * - If it expired, or the quote was ZIP-only / for another address, re-rate
 *   for the real address and ask Clint to confirm the difference first.
 * - With a confirm rate, buy it only if its shipment was made for this order.
 */
export async function planLabel(
  cfg: ShippoConfig,
  order: LabelOrder,
  from: ShipAddress,
  confirm?: { shipmentId: string; rateId: string },
  now = Date.now(),
): Promise<LabelOutcome> {
  if (!order.rateShipmentId || !order.rateId) {
    return { kind: "error", message: "This order did not use a live rate, so there is nothing to buy here." };
  }
  if (!addressComplete(order.shipTo)) {
    return { kind: "error", message: "This order has no full shipping address on file." };
  }

  // Idempotency: a label already bought on any of this order's rates wins.
  const tied = [...new Set([order.rateId, order.labelRateId, confirm?.rateId].filter(Boolean) as string[])];
  for (const rateId of tied) {
    const txs = await transactionsForRate(cfg, rateId);
    const done = txs.find((t) => t && t.status === "SUCCESS" && t.label_url);
    if (done) {
      const rate = toLiveRate(await retrieveRate(cfg, rateId).catch(() => null));
      const label = labelFromTransaction(done, rate);
      if (label) return { kind: "already", label };
    }
    if (txs.some((t) => t && (t.status === "QUEUED" || t.status === "WAITING"))) {
      return { kind: "error", message: "A label for this order is still being made by Shippo. Wait a minute and try again." };
    }
  }

  if (confirm) {
    const rate = toLiveRate(await retrieveRate(cfg, confirm.rateId));
    if (!rate || rate.shipmentId !== confirm.shipmentId || !LIVE_CARRIERS.includes(rate.carrier)) {
      return { kind: "error", message: "That quote is not valid anymore. Generate the label again." };
    }
    const shp = await retrieveShipment(cfg, confirm.shipmentId);
    const ours = confirm.shipmentId === order.rateShipmentId || plain(shp?.metadata) === labelReference(order.id);
    if (!ours) return { kind: "error", message: "That quote is not for this order." };
    if (!sameDestination(shp.address_to, order.shipTo)) {
      return { kind: "error", message: "That quote is for a different address. Generate the label again." };
    }
    const created = Date.parse(rate.createdAt || "");
    if (Number.isFinite(created) && now - created > RATE_MAX_AGE_MS) {
      return { kind: "error", message: "That quote expired. Generate the label again." };
    }
    return buyOnce(cfg, order, rate);
  }

  const original = await retrieveShipment(cfg, order.rateShipmentId);
  const parcelRaw = Array.isArray(original?.parcels) ? original.parcels[0] : null;
  const parcel: Parcel = {
    length: Number(parcelRaw?.length) || 0,
    width: Number(parcelRaw?.width) || 0,
    height: Number(parcelRaw?.height) || 0,
    weight: Number(parcelRaw?.weight) || 0,
  };
  if (!(parcel.length && parcel.width && parcel.height && parcel.weight) || (parcelRaw?.mass_unit && parcelRaw.mass_unit !== "oz")) {
    return { kind: "error", message: "The original box size could not be read back from Shippo." };
  }

  let reason = "Checkout was quoted on the ZIP code only, so it was re-rated for the full address.";
  if (sameDestination(original.address_to, order.shipTo)) {
    const rate = toLiveRate(await retrieveRate(cfg, order.rateId));
    const created = Date.parse(rate?.createdAt || "");
    const fresh = rate && (!Number.isFinite(created) || now - created <= RATE_MAX_AGE_MS);
    if (rate && fresh) return buyOnce(cfg, order, rate);
    reason = "The checkout rate is older than Shippo allows (7 days), so it was re-rated.";
  }

  const shp = await createShipment(cfg, from, order.shipTo, parcel, labelReference(order.id));
  const shipmentId = plain(shp?.object_id);
  return confirmFrom(order, shipmentId, offeredRates(shp?.rates, shipmentId), reason);
}
