import assert from "node:assert/strict";
import test from "node:test";
import { customerShipLines, packingSlipFromOrder, packingSlipSheet, shopFromLines } from "../lib/paper.ts";
import { receiptSheet } from "../lib/receipt.ts";

const order = {
  id: "order_244",
  createdAt: "2026-09-15T18:00:00.000Z",
  name: "Ada <script>",
  items: "• 1 × Way covers",
  address: "Sheridan, WY 82801",
  phone: "307-555-0100",
  shipTo: {
    name: "Ada <script>",
    company: "",
    street1: "12 Main St",
    street2: "Apt 2",
    city: "Sheridan",
    state: "WY",
    zip: "82801",
    country: "US",
    phone: "307-555-0100",
    email: "ada@example.com",
  },
  fulfillment: "ship",
  shippingLabel: "USPS Ground Advantage",
  shippingCents: 500,
  taxCents: 200,
  amountCents: 4200,
  paymentStatus: "paid",
  trackingNumber: "940011189922",
  trackingCarrier: "USPS",
  labelCarrier: "",
};

test("a packing slip uses the street address and leaves the money off", () => {
  const slip = packingSlipFromOrder(order, {
    company: "Big Horn Custom Works",
    from: {
      name: "Big Horn Custom Works",
      company: "",
      street1: "100 Shop Rd",
      street2: "",
      city: "Sheridan",
      state: "WY",
      zip: "82801",
      country: "US",
      phone: "",
      email: "shop@example.com",
    },
  });
  const html = packingSlipSheet(slip);
  assert.match(html, /Packing slip/);
  assert.match(html, /12 Main St/);
  assert.match(html, /Apt 2/);
  assert.match(html, /Sheridan, WY 82801/);
  assert.match(html, /100 Shop Rd/);
  assert.match(html, /• 1 × Way covers/);
  assert.match(html, /USPS Ground Advantage/);
  assert.match(html, /940011189922/);
  assert.match(html, /Ada &lt;script&gt;/);
  assert.equal(html.includes("ada@example.com"), false);
  assert.equal(html.includes("shop@example.com"), false);
  assert.equal(html.includes("42.00"), false);
  assert.equal(html.includes("4200"), false);
  assert.equal(html.includes("$"), false);
  assert.equal(html.includes("<script>"), false);
});

test("a short address is used when the street was not saved", () => {
  const lines = customerShipLines({
    name: "Ada",
    address: "Sheridan, WY 82801",
    phone: "307-555-0100",
    shipTo: {
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
    },
  });
  assert.match(lines, /Ada/);
  assert.match(lines, /Sheridan, WY 82801/);
  assert.match(lines, /307-555-0100/);
});

test("a blank ship-from stays the shop name and town", () => {
  const from = shopFromLines("Big Horn Custom Works", null);
  assert.equal(from, "Big Horn Custom Works\nSheridan, Wyoming");
  assert.equal(from.includes("Main"), false);
});

test("a printed receipt uses the stored total and escapes the name", () => {
  const html = receiptSheet(
    {
      id: order.id,
      createdAt: order.createdAt,
      name: order.name,
      items: order.items,
      address: customerShipLines(order),
      fulfillment: "ship",
      shippingLabel: order.shippingLabel,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      amountCents: order.amountCents,
      paymentStatus: "paid",
      paymentMethod: "Visa credit card ending 6009",
    },
    { logoUrl: "https://bighorncustomworks.com/logo.png", company: "Big Horn Custom Works" },
  );
  assert.match(html, /Receipt/);
  assert.match(html, /12 Main St/);
  assert.match(html, /Total/);
  assert.match(html, /\$42\.00/);
  assert.match(html, /Sales tax/);
  assert.match(html, /Paid with Visa credit card ending 6009/);
  assert.match(html, /Ada &lt;script&gt;/);
  assert.match(html, /src="https:\/\/bighorncustomworks\.com\/logo\.png"/);
  assert.equal(html.includes("<script>"), false);
  assert.equal(receiptSheet(
    {
      id: order.id,
      createdAt: order.createdAt,
      name: "Ada",
      items: order.items,
      address: "",
      fulfillment: "digital",
      shippingLabel: "",
      shippingCents: 0,
      taxCents: 0,
      amountCents: 800,
      paymentStatus: "paid",
    },
    { logoUrl: "http://localhost/logo.png", company: "Big Horn Custom Works" },
  ).includes("<img"), false);
});
