import assert from "node:assert/strict";
import test from "node:test";
import { receiptEmailText, receiptPaymentLine } from "../lib/receipt.ts";

const order = {
  id: "order_244",
  createdAt: "2026-09-15T18:00:00.000Z",
  name: "Ada",
  items: "• 1 × Way covers",
  address: "12 Main St\nSheridan, WY 82801",
  fulfillment: "ship",
  shippingLabel: "USPS Ground",
  shippingCents: 500,
  taxCents: 200,
  amountCents: 4200,
  paymentStatus: "paid",
};

test("a receipt uses the stored total and does not invent a line price", () => {
  const text = receiptEmailText(order);
  assert.match(text, /Hi Ada,/);
  assert.match(text, /Order: order_244/);
  assert.match(text, /Payment: Paid/);
  assert.match(text, /• 1 × Way covers/);
  assert.match(text, /Subtotal: \$35\.00/);
  assert.match(text, /Shipping: USPS Ground — \$5\.00/);
  assert.match(text, /Sales tax: \$2\.00/);
  assert.match(text, /Total: \$42\.00/);
  assert.match(text, /12 Main St/);
  assert.equal(text.includes("$25"), false);
  assert.equal(text.includes("cs_live"), false);
});

test("pickup and unpaid orders stay honest", () => {
  const pickup = receiptEmailText({
    ...order,
    fulfillment: "pickup",
    shippingLabel: "",
    shippingCents: 0,
    taxCents: 0,
    amountCents: 1000,
    address: "",
    paymentStatus: "unpaid",
  });
  assert.match(pickup, /Pickup in Sheridan, Wyoming/);
  assert.match(pickup, /Shipping: \$0\.00/);
  assert.match(pickup, /Total: \$10\.00/);
  assert.match(pickup, /Payment: Not marked paid/);
  assert.equal(pickup.includes("Subtotal"), false);
  assert.equal(pickup.includes("Payment: Paid"), false);
  assert.equal(receiptPaymentLine(""), "Paid");
  assert.equal(receiptPaymentLine("paid"), "Paid");
});

test("a digital order does not include a ship-to block", () => {
  const text = receiptEmailText({
    ...order,
    fulfillment: "digital",
    address: "should not show",
    shippingCents: 0,
    taxCents: 0,
    shippingLabel: "",
    amountCents: 800,
  });
  assert.match(text, /Nothing shipped/);
  assert.equal(text.includes("should not show"), false);
  assert.equal(text.includes("Subtotal"), false);
});
