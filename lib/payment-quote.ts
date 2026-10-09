/**
 * Custom quotes Clint sends. The goods price and the packed box stay on the
 * stored record. Checkout and Shippo both call the helpers below so a request
 * body cannot replace either one.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { PaymentQuote } from "./types";

export const PAYMENT_QUOTE_MAX_CENTS = 5_000_000;
export const PAYMENT_QUOTE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PaymentQuoteView = "open" | "paid" | "void" | "expired";

export function paymentQuoteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function tokensEqual(stored: string, given: string): boolean {
  if (!stored || !given) return false;
  const left = Buffer.from(stored);
  const right = Buffer.from(given);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Positive finite number within `max`, rounded to 2 decimals. Otherwise 0. */
export function measurePositive(value: unknown, max: number): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n) || n <= 0 || n > max) return 0;
  return Math.round(n * 100) / 100;
}

/** Integer cents from the stored quote. $0 and anything over $50,000 are rejected. */
export function quoteAmountCents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return 0;
  const cents = Math.round(n);
  if (cents <= 0 || cents > PAYMENT_QUOTE_MAX_CENTS) return 0;
  return cents;
}

/**
 * The amount Stripe charges for the goods. `clientCents` is accepted so callers
 * can pass the request body through, and it is never used.
 */
export function chargedCents(storedCents: number, _clientCents?: unknown): number {
  return quoteAmountCents(storedCents);
}

export function paymentQuoteParcel(quote: {
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}): { length: number; width: number; height: number; weight: number } | null {
  const weight = measurePositive(quote.weightOz, 2400);
  const length = measurePositive(quote.lengthIn, 108);
  const width = measurePositive(quote.widthIn, 108);
  const height = measurePositive(quote.heightIn, 108);
  if (!weight || !length || !width || !height) return null;
  return { length, width, height, weight };
}

/** Shippo parcel for this quote. A parcel on the request is ignored. */
export function parcelForCheckout(
  quote: { weightOz: number; lengthIn: number; widthIn: number; heightIn: number },
  _clientParcel?: unknown,
): { length: number; width: number; height: number; weight: number } | null {
  return paymentQuoteParcel(quote);
}

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

export function payableQuote<T extends { id: string; token: string; status: string; createdAt: string }>(
  quotes: T[],
  id: unknown,
  token: unknown,
  now = Date.now(),
): { ok: true; quote: T } | { ok: false; status: number; error: string } {
  const wantId = String(id ?? "").trim();
  const given = String(token ?? "");
  const quote = quotes.find((row) => row.id === wantId);
  if (!quote || !tokensEqual(quote.token, given)) {
    return { ok: false, status: 404, error: "This payment link is not valid." };
  }
  const error = paymentQuoteBlock(quote.status, quote.createdAt, now);
  if (error) return { ok: false, status: 400, error };
  return { ok: true, quote };
}

export function paymentLinkOrigin(): string {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (configured.startsWith("https://") && !/localhost|127\.0\.0\.1/i.test(configured)) return configured;
  return "https://bighorncustomworks.com";
}

export function paymentLinkUrl(origin: string, id: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/pay/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`;
}

export function paymentLinkEmailText(opts: {
  name: string;
  title: string;
  detail: string;
  amountLabel: string;
  url: string;
}): string {
  const who = opts.name.trim();
  const lines = [
    who ? `Hi ${who},` : "Hi,",
    "",
    "Clint at Big Horn Custom Works sent you a quote to pay.",
    "",
    opts.title.trim(),
  ];
  if (opts.detail.trim()) lines.push(opts.detail.trim());
  lines.push(
    "",
    `Quote: ${opts.amountLabel}`,
    "Shipping is added when you pay. You can have it shipped, or pick it up in Sheridan, Wyoming.",
    "Sales tax is added when it applies.",
    "",
    `Pay here: ${opts.url}`,
    "",
    "This link works for 30 days. Reply to this email if something looks wrong.",
    "",
    "— Clint, Big Horn Custom Works",
  );
  return lines.join("\n");
}

/**
 * Stripe metadata for a payment-link checkout. There is no `items` key, so the
 * webhook does not treat this as a catalog line and does not decrement stock.
 */
export function paymentQuoteMetadata(
  quote: { id: string; detail: string },
  fulfillment: "ship" | "pickup",
): Record<string, string> {
  return {
    shop: "big-horn-custom-works",
    kind: "payment-quote",
    paymentQuoteId: quote.id,
    fulfillment,
    quoteDetail: quote.detail.replace(/\s+/g, " ").trim().slice(0, 450),
  };
}

/** Webhook: a paid Checkout Session closes the link. Missing rows are ignored. */
export function markPaymentQuotePaid(
  quotes: PaymentQuote[] | undefined,
  meta: { kind?: string; paymentQuoteId?: string },
  sessionId: string,
): boolean {
  if (meta.kind !== "payment-quote" || !meta.paymentQuoteId || !quotes) return false;
  const row = quotes.find((quote) => quote.id === meta.paymentQuoteId);
  if (!row || row.status === "paid") return false;
  row.status = "paid";
  row.paidAt = new Date().toISOString();
  row.paidSessionId = sessionId.slice(0, 120);
  return true;
}

export function paymentQuoteDraftError(input: {
  email: string;
  title: string;
  amountCents: number;
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}): string {
  if (!EMAIL.test(input.email.trim())) return "Enter the customer's email.";
  if (!input.title.trim()) return "Enter what they are paying for.";
  if (!quoteAmountCents(input.amountCents)) {
    if (Number(input.amountCents) > PAYMENT_QUOTE_MAX_CENTS) {
      return "That price is over $50,000. Use a lower amount.";
    }
    return "Enter a price greater than $0.";
  }
  if (!measurePositive(input.weightOz, 2400)) {
    return "Enter the packed weight, box included, up to 150 lb.";
  }
  if (
    !measurePositive(input.lengthIn, 108) ||
    !measurePositive(input.widthIn, 108) ||
    !measurePositive(input.heightIn, 108)
  ) {
    return "Enter the box length, width, and height in inches. Each side can be up to 108 inches.";
  }
  return "";
}

function plain(value: unknown, max: number): string {
  if (value == null) return "";
  return String(value)
    .replace(/<\/?[^>]+>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function plainMultiline(value: unknown, max: number): string {
  if (value == null) return "";
  return String(value)
    .replace(/<\/?[^>]+>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

export function normalizePaymentQuote(raw: unknown): PaymentQuote | null {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const email = plain(src.email, 200);
  const title = plain(src.title, 200);
  const token = plain(src.token, 200);
  const id = plain(src.id, 80);
  const amountCents = quoteAmountCents(src.amountCents);
  const weightOz = measurePositive(src.weightOz, 2400);
  const lengthIn = measurePositive(src.lengthIn, 108);
  const widthIn = measurePositive(src.widthIn, 108);
  const heightIn = measurePositive(src.heightIn, 108);
  if (!id || !token || !EMAIL.test(email) || !title || !amountCents || !weightOz || !lengthIn || !widthIn || !heightIn) {
    return null;
  }
  const status: PaymentQuote["status"] = src.status === "paid" || src.status === "void" ? src.status : "open";
  return {
    id,
    token,
    name: plain(src.name, 120),
    email,
    title,
    detail: plainMultiline(src.detail, 2000),
    amountCents,
    weightOz,
    lengthIn,
    widthIn,
    heightIn,
    status,
    createdAt: plain(src.createdAt, 40) || new Date().toISOString(),
    emailedAt: plain(src.emailedAt, 40),
    paidAt: status === "paid" ? plain(src.paidAt, 40) : "",
    paidSessionId: status === "paid" ? plain(src.paidSessionId, 120) : "",
    archivedAt: plain(src.archivedAt, 40),
  };
}

/**
 * Master Control saves the whole store. A tab that was open before a link was
 * paid, voided, or created must not undo that. Rows the server does not
 * already have are dropped, so a quote can only be created by the send route.
 */
export function mergePaymentQuotes(incoming: unknown, current: PaymentQuote[]): PaymentQuote[] {
  if (!Array.isArray(incoming)) return current;
  const byId = new Map(current.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const merged: PaymentQuote[] = [];
  for (const row of incoming) {
    if (!row || typeof row !== "object") continue;
    const id = plain((row as { id?: unknown }).id, 80);
    const server = byId.get(id);
    if (!server) continue;
    seen.add(id);
    if (server.status === "paid" || server.status === "void") {
      merged.push(server);
      continue;
    }
    const src = row as Record<string, unknown>;
    if (src.status === "void") {
      merged.push({ ...server, status: "void" });
      continue;
    }
    const next = normalizePaymentQuote({
      ...server,
      name: src.name,
      email: src.email,
      title: src.title,
      detail: src.detail,
      amountCents: quoteAmountCents(src.amountCents) || server.amountCents,
      weightOz: measurePositive(src.weightOz, 2400) || server.weightOz,
      lengthIn: measurePositive(src.lengthIn, 108) || server.lengthIn,
      widthIn: measurePositive(src.widthIn, 108) || server.widthIn,
      heightIn: measurePositive(src.heightIn, 108) || server.heightIn,
      id: server.id,
      token: server.token,
      status: "open",
      createdAt: server.createdAt,
      emailedAt: server.emailedAt,
      paidAt: "",
      paidSessionId: "",
      archivedAt: server.archivedAt || "",
    });
    merged.push(next || server);
  }
  for (const server of current) {
    if (!seen.has(server.id)) merged.push(server);
  }
  return merged;
}
