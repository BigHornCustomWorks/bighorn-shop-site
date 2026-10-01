import assert from "node:assert/strict";
import test from "node:test";
import { receiptComment, receiptEmailHtml, receiptEmailText, receiptPaymentLine } from "../lib/receipt.ts";

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
  assert.match(text, /Payment: Paid by card through Stripe/);
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
  assert.equal(receiptPaymentLine(""), "Paid by card through Stripe");
  assert.equal(receiptPaymentLine("paid"), "Paid by card through Stripe");
  assert.equal(receiptPaymentLine("paid", "Visa credit card ending 6009"), "Paid with Visa credit card ending 6009");
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
  assert.equal(text.includes("Sales tax"), false);
});

test("a note is included, tax is omitted when it is zero, and the logo html is escaped", () => {
  const noted = receiptEmailText({
    ...order,
    paymentMethod: "Visa credit card ending 6009",
    comment: "Thanks for the custom covers.",
    taxCents: 0,
    shippingCents: 500,
    amountCents: 4000,
  });
  assert.match(noted, /Payment: Paid with Visa credit card ending 6009/);
  assert.match(noted, /Note:\nThanks for the custom covers\./);
  assert.match(noted, /Subtotal: \$35\.00/);
  assert.equal(noted.includes("Sales tax"), false);
  assert.equal(receiptComment(`  ${"a".repeat(900)}  `).length, 800);

  const html = receiptEmailHtml(
    { ...order, comment: "See <b>note</b> & more" },
    "https://bighorncustomworks.com/logo.png",
  );
  assert.match(html, /src="https:\/\/bighorncustomworks\.com\/logo\.png"/);
  assert.match(html, /See &lt;b&gt;note&lt;\/b&gt; &amp; more/);
  assert.equal(html.includes("<b>note</b>"), false);
  assert.equal(receiptEmailHtml(order, "http://localhost:3000/logo.png").includes("<img"), false);
});
