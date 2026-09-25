// Unit tests for lib/shipping.ts against mocked Shippo responses.
// Run with: npm test   (Node 22.6+ strips the TypeScript types itself)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildParcel,
  checkCartRate,
  defaultSignPack,
  labelReference,
  normalizeSignPack,
  offeredRates,
  planLabel,
  quoteRates,
  shipFromAddress,
  signParcel,
} from "../lib/shipping.ts";

const NOW = Date.parse("2026-09-25T16:00:00Z");
const FRESH = "2026-09-25T15:00:00Z";
const OLD = "2026-09-10T15:00:00Z";

const FROM = {
  name: "", company: "Test Shop", street1: "1 Test Way", street2: "", city: "Testville",
  state: "WY", zip: "82001", country: "US", phone: "5555550100", email: "",
};
const TO = {
  name: "Pat Buyer", company: "", street1: "179 N Harbor Dr", street2: "", city: "Redondo Beach",
  state: "CA", zip: "90277", country: "US", phone: "", email: "pat@example.com",
};
const PARCEL = { length: 10, width: 6, height: 4, weight: 24 };
const SETTINGS = {
  packagePresets: [{ id: "box_s", name: "Small", lengthIn: 10, widthIn: 6, heightIn: 2, emptyWeightOz: 3 }],
  packagingAllowanceOz: 2,
};

const product = (over = {}) => ({
  kind: "physical", weightOz: 8, packagePresetId: "box_s", lengthIn: 0, widthIn: 0, heightIn: 0, boxWeightOz: 0, ...over,
});

function rate(id, provider, name, token, amount, shipment = "shp_1", created = FRESH) {
  return {
    object_id: id, provider, servicelevel: { name, token }, amount, currency: "USD",
    estimated_days: 3, shipment, object_created: created,
  };
}

const RATES = [
  rate("rate_ga", "USPS", "Ground Advantage", "usps_ground_advantage", "8.20"),
  rate("rate_pri", "USPS", "Priority Mail", "usps_priority", "11.01"),
  rate("rate_ups", "UPS", "Ground", "ups_ground", "13.40"),
  rate("rate_fx", "FedEx", "FedEx Ground®", "fedex_ground", "7.00"),
];

function shipment(over = {}) {
  return {
    object_id: "shp_1",
    metadata: "",
    address_from: { ...FROM },
    address_to: { ...TO },
    parcels: [{ length: "10.0000", width: "6.0000", height: "4.0000", distance_unit: "in", weight: "24.0000", mass_unit: "oz" }],
    rates: RATES,
    ...over,
  };
}

function success(rateId) {
  return {
    object_id: "tx_1", status: "SUCCESS", rate: rateId, tracking_number: "9400TEST",
    tracking_url_provider: "https://tools.usps.com/track?x", label_url: "https://files.example/label.pdf", messages: [],
  };
}

/** Tiny fake Shippo: routes by "METHOD /path" and records every call. */
function fakeShippo(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const path = url.replace("https://api.goshippo.com", "");
    const key = `${init.method || "GET"} ${path}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ key, body, headers: init.headers });
    const handler = routes[key] || routes[key.split("?")[0] + "?*"];
    if (!handler) return new Response(JSON.stringify({ detail: `no route ${key}` }), { status: 404 });
    const [status, json] = handler(body, key);
    return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
  };
  return { cfg: { apiKey: "shippo_test_fake_for_tests", fetchImpl }, calls };
}

const noTransactions = () => [200, { results: [] }];
const rateRoutes = Object.fromEntries(RATES.map((r) => [`GET /rates/${r.object_id}`, () => [200, r]]));

const ORDER = {
  id: "order_1",
  shipTo: { ...TO, street1: "179 N. Harbor Dr." },
  rateId: "rate_pri",
  rateShipmentId: "shp_1",
  rateCarrier: "USPS",
  rateService: "Priority Mail",
  rateServiceToken: "usps_priority",
  rateCents: 1101,
  labelRateId: "",
};

test("buildParcel: item weight + empty box + allowance, presets or own box", () => {
  assert.deepEqual(buildParcel([{ product: product(), quantity: 1 }], SETTINGS), { length: 10, width: 6, height: 2, weight: 13 });
  // Two units stack: heights add, both items and both boxes count, allowance once.
  assert.deepEqual(buildParcel([{ product: product(), quantity: 2 }], SETTINGS), { length: 10, width: 6, height: 4, weight: 24 });
  // Own box overrides the preset.
  assert.deepEqual(
    buildParcel([{ product: product({ lengthIn: 12, widthIn: 9, heightIn: 3, boxWeightOz: 5 }), quantity: 1 }], SETTINGS),
    { length: 12, width: 9, height: 3, weight: 15 },
  );
  assert.equal(buildParcel([{ product: product({ weightOz: 0 }), quantity: 1 }], SETTINGS), null);
  assert.equal(buildParcel([{ product: product({ packagePresetId: "nope" }), quantity: 1 }], SETTINGS), null);
  assert.equal(buildParcel([{ product: product({ kind: "digital" }), quantity: 1 }], SETTINGS), null);
});

test("signParcel: w × h × t × density, flat pack + margin, cardboard and allowance", () => {
  const pack = defaultSignPack();
  assert.equal(pack.steelDensityLbPerIn3, 0.284);
  assert.equal(pack.aluminumDensityLbPerIn3, 0.0975);
  assert.equal(pack.marginIn, 2);
  // 12×12 steel 0.048: metal 12*12*0.048*0.284 lb = 1.963 lb = 31.41 oz
  // pack 16×16 in = 1.778 sq ft; cardboard 2 faces × 1.2 oz = 4.27 oz; allowance 4 oz → 39.7 oz
  const p = signParcel({ pack }, 12, 12);
  assert.deepEqual(p, { length: 16, width: 16, height: 1, weight: 39.7 });
  const alu = signParcel({ pack: { ...pack, material: "aluminum" } }, 24, 12);
  assert.equal(alu.length, 28);
  assert.equal(alu.width, 16);
  // 24*12*0.048*0.0975*16 = 21.57 oz metal + 3.11*2*1.2 = 7.47 + 4 = 33.0
  assert.equal(alu.weight, 33);
});

test("normalizeSignPack keeps admin edits and repairs junk", () => {
  const p = normalizeSignPack({ material: "aluminum", thicknessOptionsIn: [0.09, "x", 0.04], thicknessIn: 0.09, marginIn: 0, steelDensityLbPerIn3: -1 });
  assert.equal(p.material, "aluminum");
  assert.deepEqual(p.thicknessOptionsIn, [0.04, 0.09]);
  assert.equal(p.thicknessIn, 0.09);
  assert.equal(p.marginIn, 0);
  assert.equal(p.steelDensityLbPerIn3, 0.284);
  assert.equal(normalizeSignPack({ thicknessIn: 0.5 }).thicknessIn, 0.048);
});

test("offeredRates keeps USPS/UPS only, in cents, cheapest first", () => {
  const rates = offeredRates(RATES, "shp_1");
  assert.deepEqual(rates.map((r) => [r.carrier, r.amountCents]), [["USPS", 820], ["USPS", 1101], ["UPS", 1340]]);
  assert.equal(rates[0].displayName, "USPS Ground Advantage");
  assert.equal(rates[0].serviceToken, "usps_ground_advantage");
});

test("shipFromAddress: complete settings win, then env, else null (no invented default)", () => {
  assert.equal(shipFromAddress({ shipFrom: {} }, {}), null);
  assert.equal(shipFromAddress({ shipFrom: { zip: "82801" } }, {}), null);
  const env = { SHIP_FROM_STREET1: "2 Env St", SHIP_FROM_CITY: "Sheridan", SHIP_FROM_STATE: "wy", SHIP_FROM_ZIP: "82801" };
  assert.equal(shipFromAddress({ shipFrom: {} }, env).source, "env");
  assert.equal(shipFromAddress({ shipFrom: {} }, env).address.state, "WY");
  assert.equal(shipFromAddress({ shipFrom: FROM }, env).source, "settings");
});

test("quoteRates sends the ShippoToken header, the parcel in in/oz, sync mode", async () => {
  const { cfg, calls } = fakeShippo({ "POST /shipments/": () => [201, shipment()] });
  const out = await quoteRates(cfg, FROM, { ...TO, street1: "" }, PARCEL);
  assert.equal(out.shipmentId, "shp_1");
  assert.equal(out.rates.length, 3);
  const sent = calls[0];
  assert.equal(sent.headers.Authorization, "ShippoToken shippo_test_fake_for_tests");
  assert.deepEqual(sent.body.parcels[0], { length: "10", width: "6", height: "4", distance_unit: "in", weight: "24", mass_unit: "oz" });
  assert.equal(sent.body.async, false);
  assert.equal(sent.body.address_to.street1, undefined);
});

test("checkCartRate trusts only Shippo's amount for this exact parcel", () => {
  const shp = shipment();
  const ok = checkCartRate(RATES[1], shp, "shp_1", PARCEL, FROM, NOW);
  assert.equal(ok.ok, true);
  assert.equal(ok.rate.amountCents, 1101);
  assert.equal(checkCartRate(RATES[1], shp, "shp_1", { ...PARCEL, weight: 48 }, FROM, NOW).ok, false);
  assert.equal(checkCartRate(RATES[3], shp, "shp_1", PARCEL, FROM, NOW).ok, false);
  assert.equal(checkCartRate({ ...RATES[1], shipment: "shp_other" }, shp, "shp_1", PARCEL, FROM, NOW).ok, false);
  assert.equal(checkCartRate(RATES[1], shp, "shp_1", PARCEL, { ...FROM, zip: "10001" }, NOW).ok, false);
  assert.equal(checkCartRate({ ...RATES[1], object_created: OLD }, shp, "shp_1", PARCEL, FROM, NOW).ok, false);
  assert.equal(checkCartRate(null, shp, "shp_1", PARCEL, FROM, NOW).ok, false);
});

test("planLabel buys the exact checkout rate once when the address matches", async () => {
  const { cfg, calls } = fakeShippo({
    ...rateRoutes,
    "GET /transactions/?*": noTransactions,
    "GET /shipments/shp_1": () => [200, shipment()],
    "POST /transactions/": (b) => [201, success(b.rate)],
  });
  const out = await planLabel(cfg, ORDER, FROM, undefined, NOW);
  assert.equal(out.kind, "bought");
  assert.equal(out.label.trackingNumber, "9400TEST");
  assert.equal(out.label.labelUrl, "https://files.example/label.pdf");
  assert.equal(out.label.cents, 1101);
  const buys = calls.filter((c) => c.key === "POST /transactions/");
  assert.equal(buys.length, 1);
  assert.equal(buys[0].body.rate, "rate_pri");
  assert.equal(buys[0].body.label_file_type, "PDF_4x6");
  assert.match(buys[0].body.metadata, /^bhcw-order_1/);
});

test("planLabel never buys twice: an existing successful label is returned", async () => {
  const { cfg, calls } = fakeShippo({
    ...rateRoutes,
    "GET /transactions/?*": () => [200, { results: [success("rate_pri")] }],
  });
  const out = await planLabel(cfg, ORDER, FROM, undefined, NOW);
  assert.equal(out.kind, "already");
  assert.equal(out.label.trackingNumber, "9400TEST");
  assert.equal(calls.filter((c) => c.key === "POST /transactions/").length, 0);
});

test("planLabel refuses while Shippo is still making a label", async () => {
  const { cfg, calls } = fakeShippo({
    "GET /transactions/?*": () => [200, { results: [{ status: "QUEUED" }] }],
  });
  const out = await planLabel(cfg, ORDER, FROM, undefined, NOW);
  assert.equal(out.kind, "error");
  assert.equal(calls.filter((c) => c.key === "POST /transactions/").length, 0);
});

test("planLabel re-rates a rate older than 7 days and asks to confirm the difference", async () => {
  const fresh = shipment({
    object_id: "shp_2",
    metadata: labelReference("order_1"),
    rates: [rate("rate_pri2", "USPS", "Priority Mail", "usps_priority", "11.45", "shp_2")],
  });
  const { cfg, calls } = fakeShippo({
    "GET /rates/rate_pri": () => [200, { ...RATES[1], object_created: OLD }],
    "GET /transactions/?*": noTransactions,
    "GET /shipments/shp_1": () => [200, shipment()],
    "POST /shipments/": () => [201, fresh],
  });
  const out = await planLabel(cfg, ORDER, FROM, undefined, NOW);
  assert.equal(out.kind, "confirm");
  assert.equal(out.rateId, "rate_pri2");
  assert.equal(out.oldCents, 1101);
  assert.equal(out.newCents, 1145);
  assert.equal(out.sameService, true);
  assert.equal(calls.filter((c) => c.key === "POST /transactions/").length, 0);
});

test("planLabel re-quotes a ZIP-only checkout for the full address, then buys on confirm", async () => {
  const zipOnly = shipment({ address_to: { zip: "90277", country: "US" } });
  const freshRates = [
    rate("rate_new_ga", "USPS", "Ground Advantage", "usps_ground_advantage", "8.40", "shp_2"),
    rate("rate_new_pri", "USPS", "Priority Mail", "usps_priority", "10.90", "shp_2"),
  ];
  const fresh = shipment({ object_id: "shp_2", metadata: labelReference("order_1"), rates: freshRates });
  const { cfg, calls } = fakeShippo({
    ...rateRoutes,
    "GET /rates/rate_new_pri": () => [200, freshRates[1]],
    "GET /transactions/?*": noTransactions,
    "GET /shipments/shp_1": () => [200, zipOnly],
    "POST /shipments/": () => [201, fresh],
    "GET /shipments/shp_2": () => [200, fresh],
    "POST /transactions/": (b) => [201, success(b.rate)],
  });
  const first = await planLabel(cfg, ORDER, FROM, undefined, NOW);
  assert.equal(first.kind, "confirm");
  assert.equal(first.shipmentId, "shp_2");
  assert.equal(first.rateId, "rate_new_pri");
  assert.equal(first.newCents - first.oldCents, -11);
  const created = calls.find((c) => c.key === "POST /shipments/");
  assert.equal(created.body.metadata, "bhcw-order_1");
  assert.equal(created.body.parcels[0].weight, "24");
  assert.equal(created.body.address_to.street1, "179 N. Harbor Dr.");
  assert.equal(calls.filter((c) => c.key === "POST /transactions/").length, 0);

  const second = await planLabel(cfg, { ...ORDER, labelRateId: "rate_new_pri" }, FROM, {
    shipmentId: "shp_2",
    rateId: "rate_new_pri",
  }, NOW);
  assert.equal(second.kind, "bought");
  assert.equal(second.label.cents, 1090);
  assert.equal(calls.filter((c) => c.key === "POST /transactions/").length, 1);
});

test("planLabel refuses a confirm for a shipment that is not this order's", async () => {
  const strangerRate = rate("rate_x", "USPS", "Priority Mail", "usps_priority", "5.00", "shp_9");
  const { cfg, calls } = fakeShippo({
    "GET /transactions/?*": noTransactions,
    "GET /rates/rate_x": () => [200, strangerRate],
    "GET /shipments/shp_9": () => [200, shipment({ object_id: "shp_9", metadata: "someone-else", rates: [strangerRate] })],
  });
  const out = await planLabel(cfg, ORDER, FROM, { shipmentId: "shp_9", rateId: "rate_x" }, NOW);
  assert.equal(out.kind, "error");
  assert.equal(calls.filter((c) => c.key === "POST /transactions/").length, 0);
});

test("planLabel reports a Shippo label error instead of retrying blindly", async () => {
  const { cfg } = fakeShippo({
    ...rateRoutes,
    "GET /transactions/?*": noTransactions,
    "GET /shipments/shp_1": () => [200, shipment()],
    "POST /transactions/": () => [201, { status: "ERROR", messages: [{ text: "Address not deliverable" }] }],
  });
  const out = await planLabel(cfg, ORDER, FROM, undefined, NOW);
  assert.equal(out.kind, "error");
  assert.match(out.message, /Address not deliverable/);
});

test("planLabel refuses orders without a live rate", async () => {
  const { cfg } = fakeShippo({});
  const out = await planLabel(cfg, { ...ORDER, rateId: "", rateShipmentId: "" }, FROM);
  assert.equal(out.kind, "error");
});
