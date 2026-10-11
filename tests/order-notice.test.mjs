import assert from "node:assert/strict";
import { test } from "node:test";
import { orderNoticeSubject, orderNoticeText, orderSourceLabel } from "../lib/order-notice.ts";

test("a new order notice names the customer, phone, and what they ordered", () => {
  const detail = {
    email: "buyer@example.com",
    name: "Ada Lovelace",
    phone: "307-555-0100",
    amountLabel: "$182.65",
    items: "• 1 × Custom bear and moose welcome sign",
    address: "1 Main\nSt George, UT 84770",
    sessionId: "cs_live_example",
    paid: true,
    shippingLabel: "USPS Ground Advantage",
    shippingLabelCost: "$47.65",
    taxLabel: "$0.00",
    source: orderSourceLabel("payment-quote"),
  };
  assert.equal(orderNoticeSubject(detail), "New order $182.65 — Ada Lovelace");
  assert.equal(orderSourceLabel("sign-estimate"), "Custom sign checkout");
  assert.equal(orderSourceLabel(""), "Shop checkout");
  const text = orderNoticeText(detail);
  assert.match(text, /New paid order/);
  assert.match(text, /Phone: 307-555-0100/);
  assert.match(text, /Email: buyer@example.com/);
  assert.match(text, /Custom bear and moose welcome sign/);
  assert.match(text, /Came from: Custom payment link/);
  assert.match(text, /Shipping paid: USPS Ground Advantage — \$47\.65/);
  assert.match(text, /Sales tax collected: \$0\.00/);
  assert.match(text, /St George, UT 84770/);
  assert.match(text, /Open Master Control/);
  assert.match(text, /listed under Inbox/);
});

test("a shop checkout notice still says when the phone was not collected", () => {
  const text = orderNoticeText({
    email: "",
    name: "",
    amountLabel: "$12.00",
    items: "",
    address: "",
    sessionId: "cs_test_example",
    paid: false,
    source: orderSourceLabel("catalog"),
  });
  assert.equal(orderNoticeSubject({ amountLabel: "$12.00", name: "", email: "" }), "New order $12.00 — a customer");
  assert.match(text, /Phone: \(none\)/);
  assert.match(text, /What they ordered:\n\(none listed\)/);
  assert.match(text, /Came from: Shop checkout/);
  assert.match(text, /Paid: no/);
});
