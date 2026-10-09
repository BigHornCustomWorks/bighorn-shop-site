import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutContactParams } from "../lib/checkout-contact.ts";
import { keepIncomingArchive } from "../lib/archive.ts";
import {
  customerKey,
  filterOrders,
  fulfillmentFromCart,
  ordersForCustomer,
  ordersToCsv,
  paymentHaystack,
  quoteHaystack,
  smsOptInFromCustomFields,
  visibleMessages,
} from "../lib/order-history.ts";

const shipTo = {
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

function order(over = {}) {
  return {
    id: "order_1",
    createdAt: "2026-09-01T18:00:00.000Z",
    email: "Ada@Example.com",
    name: "Ada",
    phone: "307-555-0100",
    smsOptIn: false,
    reviewRequestedAt: "",
    amountCents: 2000,
    items: "• 1 × Dog 1",
    address: "1 Main\nSheridan, WY 82801",
    sessionId: "cs_1",
    shippingLabel: "",
    fulfillment: "ship",
    shippingCents: 0,
    taxCents: 0,
    trackingCarrier: "",
    trackingNumber: "",
    shippedAt: "",
    customerNotified: false,
    emailed: true,
    read: true,
    paymentStatus: "paid",
    shipTo: { ...shipTo },
    rateId: "",
    rateShipmentId: "",
    rateCarrier: "",
    rateService: "",
    rateServiceToken: "",
    rateCents: 0,
    labelRateId: "",
    labelStatus: "",
    labelStartedAt: "",
    labelError: "",
    labelUrl: "",
    labelTrackingUrl: "",
    labelCarrier: "",
    labelService: "",
    labelCents: 0,
    labelBoughtAt: "",
    ...over,
  };
}

const products = [
  { id: "p_dog", name: "Dog 1", slug: "dog-1", sku: "230", category: "3D printer dogs" },
  { id: "p_way", name: "Baffled Y and Z way covers", slug: "way-covers", sku: "221", category: "Mill accessories" },
];

const baseFilters = {
  from: "2026-06-03",
  to: "2026-09-01",
  allTime: false,
  productId: "",
  category: "",
  itemQuery: "",
  fulfillment: "",
  smsOnly: false,
  reviewPending: false,
  hasPhone: false,
  hasEmail: false,
  sort: "newest",
};

test("checkout always collects a phone and an optional text opt-in defaulting to No", () => {
  const contact = checkoutContactParams();
  assert.equal(contact.phone_number_collection.enabled, true);
  const field = contact.custom_fields[0];
  assert.equal(field.key, "sms_opt_in");
  assert.equal(field.optional, true);
  assert.equal(field.type, "dropdown");
  assert.equal(field.label.custom, "Text me order updates and a review request?");
  assert.ok(field.label.custom.length <= 50);
  assert.equal(field.dropdown.default_value, "no");
  assert.deepEqual(
    field.dropdown.options.map((option) => option.value),
    ["no", "yes"],
  );
});

test("sms opt-in is true only when the dropdown value is yes", () => {
  assert.equal(smsOptInFromCustomFields([{ key: "sms_opt_in", type: "dropdown", dropdown: { value: "yes" } }]), true);
  assert.equal(smsOptInFromCustomFields([{ key: "sms_opt_in", type: "dropdown", dropdown: { value: "no" } }]), false);
  assert.equal(smsOptInFromCustomFields(undefined), false);
});

test("a cart of only digital products is digital, and pickup wins", () => {
  const products = [
    { slug: "dog-1", kind: "physical" },
    { slug: "repair-app", kind: "digital" },
  ];
  assert.equal(fulfillmentFromCart("ship", ["repair-app"], products), "digital");
  assert.equal(fulfillmentFromCart("ship", ["dog-1", "repair-app"], products), "ship");
  assert.equal(fulfillmentFromCart("pickup", ["repair-app"], products), "pickup");
});

test("date range, product, and item text filter together", () => {
  const rows = [
    order(),
    order({
      id: "order_old",
      createdAt: "2026-01-02T18:00:00.000Z",
      items: "• 1 × Baffled Y and Z way covers",
      amountCents: 5000,
      name: "Bea",
    }),
    order({
      id: "order_pump",
      createdAt: "2026-08-15T18:00:00.000Z",
      items: "• 2 × Pumpkin face",
      email: "bea@example.com",
      name: "Bea",
      phone: "",
      smsOptIn: true,
    }),
  ];
  const ranged = filterOrders(rows, products, baseFilters);
  assert.deepEqual(
    ranged.map((row) => row.id),
    ["order_1", "order_pump"],
  );
  const dogs = filterOrders(rows, products, { ...baseFilters, productId: "p_dog" });
  assert.deepEqual(
    dogs.map((row) => row.id),
    ["order_1"],
  );
  const mill = filterOrders(rows, products, { ...baseFilters, allTime: true, category: "Mill accessories" });
  assert.deepEqual(
    mill.map((row) => row.id),
    ["order_old"],
  );
  const text = filterOrders(rows, products, { ...baseFilters, itemQuery: "pumpkin" });
  assert.deepEqual(
    text.map((row) => row.id),
    ["order_pump"],
  );
  const all = filterOrders(rows, products, { ...baseFilters, allTime: true });
  assert.equal(all.length, 3);
  const sms = filterOrders(rows, products, { ...baseFilters, allTime: true, smsOnly: true });
  assert.deepEqual(
    sms.map((row) => row.id),
    ["order_pump"],
  );
  const pending = filterOrders(rows, products, {
    ...baseFilters,
    allTime: true,
    reviewPending: true,
  });
  assert.equal(pending.some((row) => row.id === "order_1"), true);
  const asked = filterOrders(
    [order({ reviewRequestedAt: "2026-09-02T18:00:00.000Z" })],
    products,
    { ...baseFilters, reviewPending: true },
  );
  assert.equal(asked.length, 0);
});

test("search matches a name and a phone typed as digits, and an archived order stays listed", () => {
  const rows = [
    order(),
    order({
      id: "order_phone",
      name: "Cam",
      email: "cam@example.com",
      phone: "406-555-0199",
      items: "• 1 × Widget",
    }),
    order({ id: "order_arch", name: "Dee", archivedAt: "2026-09-02T00:00:00.000Z" }),
  ];
  const byName = filterOrders(rows, products, { ...baseFilters, itemQuery: "Cam" });
  assert.deepEqual(
    byName.map((row) => row.id),
    ["order_phone"],
  );
  const byPhone = filterOrders(rows, products, { ...baseFilters, itemQuery: "406555" });
  assert.deepEqual(
    byPhone.map((row) => row.id),
    ["order_phone"],
  );
  const listed = filterOrders(rows, products, baseFilters);
  assert.equal(listed.some((row) => row.id === "order_arch"), true);
});

test("history messages show archived rows until a search, and a payment token is not searchable", () => {
  const quotes = [
    { id: "q1", name: "Ada", email: "a@example.com", need: "a sign", createdAt: "2026-10-02T00:00:00.000Z", archivedAt: "" },
    { id: "q2", name: "Bea", email: "b@example.com", need: "a bracket", createdAt: "2026-10-01T00:00:00.000Z", archivedAt: "2026-10-03T00:00:00.000Z" },
  ];
  assert.deepEqual(
    visibleMessages(quotes, "", quoteHaystack).map((row) => row.id),
    ["q2"],
  );
  assert.deepEqual(
    visibleMessages(quotes, "Ada", quoteHaystack).map((row) => row.id),
    ["q1"],
  );
  const link = {
    id: "pay_1",
    name: "Ada",
    email: "a@example.com",
    title: "Bracket",
    detail: "steel",
    token: "secret-token-value",
    createdAt: "2026-10-01T00:00:00.000Z",
    archivedAt: "",
  };
  assert.equal(paymentHaystack(link).includes("secret-token-value"), false);
  assert.equal(visibleMessages([link], "secret-token-value", paymentHaystack).length, 0);
  assert.equal(visibleMessages([link], "Bracket", paymentHaystack).length, 1);
});

test("a master save keeps the server archive stamp on a quote and clears it on a new one", () => {
  const kept = keepIncomingArchive(
    [
      { id: "q1", name: "Ada", archivedAt: "" },
      { id: "q2", name: "New", archivedAt: "2026-10-09T00:00:00.000Z" },
    ],
    [{ id: "q1", archivedAt: "2026-10-02T00:00:00.000Z" }],
  );
  assert.equal(kept[0].archivedAt, "2026-10-02T00:00:00.000Z");
  assert.equal(kept[1].archivedAt, "");
});

test("sort by amount and group a customer by email", () => {
  const rows = [
    order({ id: "low", amountCents: 100, name: "Zoe" }),
    order({ id: "high", amountCents: 9000, name: "Ada", email: "ada@example.com" }),
  ];
  const byAmount = filterOrders(rows, products, { ...baseFilters, sort: "amount-desc" });
  assert.deepEqual(
    byAmount.map((row) => row.id),
    ["high", "low"],
  );
  const history = ordersForCustomer(rows, rows[1]);
  assert.equal(history.length, 2);
  assert.equal(customerKey(rows[0]), customerKey(order({ email: " ada@example.com " })));
});

test("csv export follows the filtered rows and quotes commas", () => {
  const csv = ordersToCsv([order({ items: "• 1 × Dog 1, painted" })]);
  assert.match(csv, /order id,name,email,phone,smsOptIn,amount,items,fulfillment,shipped,reviewRequestedAt/);
  assert.match(csv, /order_1,Ada,Ada@Example.com,307-555-0100,no,20.00,"• 1 × Dog 1, painted",ship,no,/);
});
