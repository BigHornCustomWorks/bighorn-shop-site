import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { sendPaymentQuoteEmail } from "@/lib/email";
import { formatUsd } from "@/lib/money";
import {
  normalizePaymentQuote,
  paymentLinkOrigin,
  paymentLinkUrl,
  paymentQuoteDraftError,
  paymentQuoteToken,
  quotePayable,
} from "@/lib/payment-quote";
import { cleanStr, newId } from "@/lib/sanitize";
import { readStore, writeStore } from "@/lib/store";
import type { PaymentQuote, ShopStore } from "@/lib/types";

export const runtime = "nodejs";

function linkFor(quote: PaymentQuote): string {
  return paymentLinkUrl(paymentLinkOrigin(), quote.id, quote.token);
}

async function emailQuote(quote: PaymentQuote): Promise<{ ok: true } | { ok: false; error: string }> {
  return sendPaymentQuoteEmail({
    to: quote.email,
    name: quote.name,
    title: quote.title,
    detail: quote.detail,
    amountLabel: formatUsd(quote.amountCents),
    url: linkFor(quote),
  });
}

async function saveEmailed(id: string): Promise<PaymentQuote | null> {
  const store = await readStore();
  const row = (store.paymentQuotes || []).find((quote) => quote.id === id);
  if (!row) return null;
  row.emailedAt = new Date().toISOString();
  await writeStore(store);
  return row;
}

export async function POST(req: Request) {
  if (!(await isMaster())) return NextResponse.json({ error: "auth" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Bad JSON." }, { status: 400 });
  }

  const store = await readStore();
  if (body.void === true || body.resend === true) {
    return updateExisting(store, body);
  }
  return createQuote(store, body);
}

async function updateExisting(store: ShopStore, body: { id?: unknown; void?: unknown; resend?: unknown }) {
  const id = cleanStr(body.id);
  const quote = (store.paymentQuotes || []).find((row) => row.id === id);
  if (!quote) return NextResponse.json({ error: "That payment link was not found." }, { status: 404 });

  if (body.void === true) {
    if (quote.status === "paid") {
      return NextResponse.json({ error: "This quote is already paid." }, { status: 400 });
    }
    quote.status = "void";
    const saved = await writeStore(store);
    if (!saved.ok) return NextResponse.json({ error: "Could not save the cancel." }, { status: 500 });
    return NextResponse.json({ ok: true, quote });
  }

  const block = quotePayable(quote.status, quote.createdAt);
  if (block !== "open") {
    const error =
      block === "paid"
        ? "This quote is already paid."
        : block === "void"
          ? "This quote was canceled."
          : "This link expired. Send a new quote.";
    return NextResponse.json({ error }, { status: 400 });
  }

  const sent = await emailQuote(quote);
  const saved = sent.ok ? (await saveEmailed(quote.id)) || quote : quote;
  return NextResponse.json({
    ok: true,
    emailed: sent.ok,
    quote: saved,
    error: sent.ok ? "" : sent.error,
  });
}

async function createQuote(store: ShopStore, body: Record<string, unknown>) {
  const draft = {
    email: cleanStr(body.email).slice(0, 200),
    title: cleanStr(body.title).slice(0, 200),
    amountCents: Number(body.amountCents),
    weightOz: Number(body.weightOz),
    lengthIn: Number(body.lengthIn),
    widthIn: Number(body.widthIn),
    heightIn: Number(body.heightIn),
  };
  const problem = paymentQuoteDraftError(draft);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const quote = normalizePaymentQuote({
    id: newId("pay"),
    token: paymentQuoteToken(),
    name: body.name,
    email: draft.email,
    title: draft.title,
    detail: body.detail,
    amountCents: draft.amountCents,
    weightOz: draft.weightOz,
    lengthIn: draft.lengthIn,
    widthIn: draft.widthIn,
    heightIn: draft.heightIn,
    status: "open",
    createdAt: new Date().toISOString(),
    emailedAt: "",
    paidAt: "",
    paidSessionId: "",
  });
  if (!quote) return NextResponse.json({ error: "Check the quote and try again." }, { status: 400 });

  store.paymentQuotes = [quote, ...(store.paymentQuotes || [])].slice(0, 200);
  const saved = await writeStore(store);
  if (!saved.ok) {
    return NextResponse.json({ error: "Could not save the quote. Nothing was emailed." }, { status: 500 });
  }

  const sent = await emailQuote(quote);
  const stored = sent.ok ? (await saveEmailed(quote.id)) || quote : quote;
  return NextResponse.json({
    ok: true,
    emailed: sent.ok,
    quote: stored,
    error: sent.ok ? "" : sent.error,
  });
}
