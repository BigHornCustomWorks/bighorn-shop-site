import assert from "node:assert/strict";
import test from "node:test";
import { quotePayable as quotePayableInBrowser } from "../lib/payment-quote-view.ts";
import {
  chargedCents,
  mergePaymentQuotes,
  normalizePaymentQuote,
  parcelForCheckout,
  payableQuote,
  paymentLinkEmailText,
  paymentQuoteDraftError,
  paymentQuoteMetadata,
  quoteAmountCents,
  quotePayable,
  tokensEqual,
} from "../lib/payment-quote.ts";

const DAY = 24 * 60 * 60 * 1000;

function sample(overrides = {}) {
  return normalizePaymentQuote({
    id: "pay_test",
    token: "tok_abcdefghijklmnopqrstuvwxyz12",
    name: "Ada",
    email: "ada@example.com",
    title: "Bracket",
    detail: "One steel bracket",
    amountCents: 12500,
    weightOz: 32,
    lengthIn: 10,
    widthIn: 8,
    heightIn: 4,
    status: "open",
    createdAt: "2026-10-01T12:00:00.000Z",
    emailedAt: "",
    paidAt: "",
    paidSessionId: "",
    ...overrides,
  });
}

test("the charged price is the stored quote, never the request", () => {
  assert.equal(chargedCents(12500, 100), 12500);
  assert.equal(chargedCents(12500, 0), 12500);
  assert.equal(chargedCents(12500, 999999), 12500);
  assert.equal(quoteAmountCents(0), 0);
  assert.equal(quoteAmountCents(5_000_001), 0);
  assert.equal(quoteAmountCents(5_000_000), 5_000_000);
});

test("shipping uses the stored box, not a parcel on the request", () => {
  const quote = sample();
  assert.ok(quote);
  assert.deepEqual(parcelForCheckout(quote, { length: 1, width: 1, height: 1, weight: 1, amountCents: 100 }), {
    length: 10,
    width: 8,
    height: 4,
    weight: 32,
  });
});

test("a wrong token does not open the quote", () => {
  const quote = sample();
  assert.ok(quote);
  const bad = payableQuote([quote], quote.id, "nope");
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.status, 404);
  const good = payableQuote([quote], quote.id, quote.token);
  assert.equal(good.ok, true);
  assert.equal(tokensEqual(quote.token, quote.token), true);
  assert.equal(tokensEqual(quote.token, ""), false);
});

test("paid, canceled, and expired links stay closed", () => {
  const created = Date.parse("2026-10-01T12:00:00.000Z");
  assert.equal(quotePayable("open", "2026-10-01T12:00:00.000Z", created + 29 * DAY), "open");
  assert.equal(quotePayable("open", "2026-10-01T12:00:00.000Z", created + 31 * DAY), "expired");
  assert.equal(quotePayable("paid", "2026-10-01T12:00:00.000Z", created), "paid");
  assert.equal(quotePayable("void", "2026-10-01T12:00:00.000Z", created), "void");
  assert.equal(quotePayableInBrowser("open", "2026-10-01T12:00:00.000Z", created + 31 * DAY), "expired");
  assert.equal(quotePayableInBrowser("paid", "2026-10-01T12:00:00.000Z", created), "paid");
  const quote = sample();
  assert.ok(quote);
  const paid = payableQuote([{ ...quote, status: "paid" }], quote.id, quote.token);
  assert.equal(paid.ok, false);
  if (!paid.ok) assert.match(paid.error, /already paid/);
});

test("a save cannot un-pay a quote, rewrite its token, or drop one the tab never loaded", () => {
  const open = sample();
  const paid = sample({
    id: "pay_paid",
    token: "tok_paid_xxxxxxxxxxxxxxxxxxxx",
    status: "paid",
    amountCents: 8000,
    paidAt: "2026-10-02T12:00:00.000Z",
    paidSessionId: "cs_test_paid",
  });
  const hidden = sample({ id: "pay_hidden", token: "tok_hidden_xxxxxxxxxxxxxxxxxx" });
  assert.ok(open && paid && hidden);
  const merged = mergePaymentQuotes(
    [
      { ...open, token: "stolen", amountCents: 100, status: "open" },
      { ...paid, status: "open", amountCents: 100, token: "stolen" },
    ],
    [open, paid, hidden],
  );
  const savedOpen = merged.find((row) => row.id === open.id);
  const savedPaid = merged.find((row) => row.id === paid.id);
  const savedHidden = merged.find((row) => row.id === hidden.id);
  assert.equal(savedOpen && savedOpen.token, open.token);
  assert.equal(savedOpen && savedOpen.amountCents, 100);
  assert.equal(savedPaid && savedPaid.status, "paid");
  assert.equal(savedPaid && savedPaid.amountCents, 8000);
  assert.equal(savedPaid && savedPaid.token, paid.token);
  assert.equal(savedPaid && savedPaid.paidSessionId, "cs_test_paid");
  assert.ok(savedHidden);
  const invented = mergePaymentQuotes(
    [{ ...open, id: "pay_new", token: "tok_new", amountCents: 100 }],
    [open],
  );
  assert.equal(invented.some((row) => row.id === "pay_new"), false);
});

test("a save cannot clear archivedAt on a payment link", () => {
  const open = sample({ archivedAt: "2026-10-02T12:00:00.000Z" });
  assert.ok(open);
  assert.equal(open.archivedAt, "2026-10-02T12:00:00.000Z");
  const merged = mergePaymentQuotes([{ ...open, archivedAt: "", amountCents: 100 }], [open]);
  assert.equal(merged[0].archivedAt, "2026-10-02T12:00:00.000Z");
  assert.equal(merged[0].amountCents, 100);
  const paid = sample({
    id: "pay_paid",
    status: "paid",
    archivedAt: "2026-10-03T00:00:00.000Z",
    paidAt: "2026-10-03T00:00:00.000Z",
    paidSessionId: "cs_x",
  });
  assert.ok(paid);
  const mergedPaid = mergePaymentQuotes([{ ...paid, archivedAt: "", status: "open" }], [paid]);
  assert.equal(mergedPaid[0].archivedAt, "2026-10-03T00:00:00.000Z");
  assert.equal(mergedPaid[0].status, "paid");
});

test("checkout metadata does not look like a catalog line", () => {
  const meta = paymentQuoteMetadata({ id: "pay_test", detail: "One steel bracket" }, "ship");
  assert.equal(meta.kind, "payment-quote");
  assert.equal(meta.paymentQuoteId, "pay_test");
  assert.equal(Object.prototype.hasOwnProperty.call(meta, "items"), false);
  assert.equal(meta.quoteDetail, "One steel bracket");
});

test("the email states the quote and that shipping is added at payment", () => {
  const text = paymentLinkEmailText({
    name: "Ada",
    title: "Bracket",
    detail: "One steel bracket",
    amountLabel: "$125.00",
    url: "https://bighorncustomworks.com/pay/pay_test?t=tok",
  });
  assert.match(text, /Hi Ada,/);
  assert.match(text, /Bracket/);
  assert.match(text, /Quote: \$125\.00/);
  assert.match(text, /Shipping is added when you pay/);
  assert.match(text, /https:\/\/bighorncustomworks.com\/pay\/pay_test\?t=tok/);
  assert.equal(text.includes("$1.00"), false);
});

test("a quote without a price or a box is rejected", () => {
  assert.match(paymentQuoteDraftError({
    email: "ada@example.com",
    title: "Bracket",
    amountCents: 0,
    weightOz: 16,
    lengthIn: 10,
    widthIn: 8,
    heightIn: 4,
  }), /greater than \$0/);
  assert.equal(normalizePaymentQuote({ ...sample(), amountCents: 0, token: "tok_abcdefghijklmnopqrstuvwxyz12" }), null);
  assert.equal(
    normalizePaymentQuote({
      id: "pay_test",
      token: "tok_abcdefghijklmnopqrstuvwxyz12",
      email: "ada@example.com",
      title: "Bracket",
      amountCents: 12500,
      weightOz: 0,
      lengthIn: 10,
      widthIn: 8,
      heightIn: 4,
    }),
    null,
  );
});
