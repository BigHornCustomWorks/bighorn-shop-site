/**
 * Browser copy of quotePayable / paymentQuoteBlock in payment-quote.ts.
 * This file has no Node builtins, so Master Control can import it.
 * Keep the two copies the same. tests/payment-quote.test.mjs checks that.
 */

export const PAYMENT_QUOTE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PaymentQuoteView = "open" | "paid" | "void" | "expired";

export function quotePayable(status: string, createdAt: string, now = Date.now()): PaymentQuoteView {
  if (status === "paid") return "paid";
  if (status === "void") return "void";
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return "expired";
  if (now > created + PAYMENT_QUOTE_DAYS * DAY_MS) return "expired";
  return "open";
}

export function paymentQuoteBlock(status: string, createdAt: string, now = Date.now()): string {
  const state = quotePayable(status, createdAt, now);
  if (state === "open") return "";
  if (state === "paid") return "This quote is already paid.";
  if (state === "void") return "This quote was canceled.";
  return "This quote has expired. Ask Big Horn Custom Works for a new link.";
}
