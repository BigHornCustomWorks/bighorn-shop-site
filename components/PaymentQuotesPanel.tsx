"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { formatUsd } from "@/lib/money";
import { orderWhen } from "@/lib/order-history";
import { quotePayable } from "@/lib/payment-quote-view";
import type { PaymentQuote } from "@/lib/types";

function weightLabel(oz: number): string {
  if (oz >= 16) {
    const lb = Math.round((oz / 16) * 100) / 100;
    return `${lb} lb`;
  }
  return `${oz} oz`;
}

function statusLabel(quote: PaymentQuote): string {
  const state = quotePayable(quote.status, quote.createdAt);
  if (state === "paid") {
    return quote.paidAt ? `Paid ${orderWhen(quote.paidAt)}. The order is listed under Orders.` : "Paid. The order is listed under Orders.";
  }
  if (state === "void") return "Canceled";
  if (state === "expired") return "Expired — send a new quote";
  return quote.emailedAt ? "Waiting for payment" : "Saved — email did not send";
}

function payUrl(quote: PaymentQuote): string {
  return `${window.location.origin}/pay/${encodeURIComponent(quote.id)}?t=${encodeURIComponent(quote.token)}`;
}

export function PaymentQuotesPanel({
  quotes,
  onQuotes,
  onArchive,
}: {
  quotes: PaymentQuote[];
  onQuotes: (quotes: PaymentQuote[]) => void;
  onArchive: (id: string, archived: boolean) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"oz" | "lb">("lb");
  const [lengthIn, setLengthIn] = useState("");
  const [widthIn, setWidthIn] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [busy, setBusy] = useState(false);
  const [archiveId, setArchiveId] = useState("");
  const [note, setNote] = useState("");
  const [noteBad, setNoteBad] = useState(false);

  function remember(quote: PaymentQuote) {
    onQuotes([quote, ...quotes.filter((row) => row.id !== quote.id)].slice(0, 200));
  }

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/master/payment-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Could not save that quote.");
    return json as { emailed?: boolean; quote?: PaymentQuote; error?: string };
  }

  async function send() {
    const typed = Number(weight);
    const weightOz =
      Number.isFinite(typed) && typed > 0 ? (unit === "lb" ? Math.round(typed * 16 * 100) / 100 : typed) : 0;
    setBusy(true);
    setNote("");
    setNoteBad(false);
    try {
      const json = await post({
        name,
        email,
        title,
        detail,
        amountCents,
        weightOz,
        lengthIn: Number(lengthIn),
        widthIn: Number(widthIn),
        heightIn: Number(heightIn),
      });
      if (json.quote) remember(json.quote);
      setName("");
      setEmail("");
      setTitle("");
      setDetail("");
      setAmountCents(0);
      setWeight("");
      setLengthIn("");
      setWidthIn("");
      setHeightIn("");
      if (json.emailed) {
        setNote("Email sent. They pay the quote plus shipping on the link.");
      } else {
        setNoteBad(true);
        setNote(json.error || "The link is saved. Use Copy link and send it yourself.");
      }
    } catch (err) {
      setNoteBad(true);
      setNote(err instanceof Error ? err.message : "Could not send the quote.");
    } finally {
      setBusy(false);
    }
  }

  async function resend(quote: PaymentQuote) {
    setBusy(true);
    setNote("");
    setNoteBad(false);
    try {
      const json = await post({ id: quote.id, resend: true });
      if (json.quote) remember(json.quote);
      if (json.emailed) setNote(`Email sent again to ${quote.email}.`);
      else {
        setNoteBad(true);
        setNote(json.error || "The email did not send. Use Copy link.");
      }
    } catch (err) {
      setNoteBad(true);
      setNote(err instanceof Error ? err.message : "Could not resend.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelQuote(quote: PaymentQuote) {
    if (!window.confirm("Cancel this payment link? They will not be able to pay it.")) return;
    setBusy(true);
    setNote("");
    setNoteBad(false);
    try {
      const json = await post({ id: quote.id, void: true });
      if (json.quote) remember(json.quote);
      setNote("Payment link canceled.");
    } catch (err) {
      setNoteBad(true);
      setNote(err instanceof Error ? err.message : "Could not cancel that link.");
    } finally {
      setBusy(false);
    }
  }

  async function archive(quote: PaymentQuote) {
    setArchiveId(quote.id);
    setNote("");
    setNoteBad(false);
    const ok = await onArchive(quote.id, true);
    if (!ok) {
      setNoteBad(true);
      setNote("Could not archive that link.");
    }
    setArchiveId("");
  }

  async function copyLink(quote: PaymentQuote) {
    const url = payUrl(quote);
    try {
      await navigator.clipboard.writeText(url);
      setNoteBad(false);
      setNote("Link copied.");
    } catch {
      setNoteBad(false);
      setNote(url);
    }
  }

  const visible = quotes.filter((quote) => !(quote.archivedAt || "").trim());

  return (
    <div>
      <h2>Send a payment link</h2>
      <p className="note">
        You set the price and the packed box. They get an email link, pick live shipping or free Sheridan pickup, and
        pay that price plus shipping in Stripe. Sales tax is added when it applies. Nothing is charged until they pay.
        The price cap is $50,000. The box can be up to 150 lb and 108 inches on a side.
      </p>
      <div className="form" style={{ marginBottom: 18 }}>
        <label>
          Customer name
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Customer email
          <input value={email} type="email" maxLength={200} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          What they are paying for
          <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Details
          <textarea value={detail} maxLength={2000} rows={4} onChange={(e) => setDetail(e.target.value)} />
        </label>
        <label>
          Price
          <MoneyInput cents={amountCents} onCents={setAmountCents} />
        </label>
        <label>
          Packed weight, box included ({unit})
          <span style={{ display: "flex", gap: 6 }}>
            <input
              type="number"
              min={0}
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
            <select value={unit} onChange={(e) => setUnit(e.target.value === "oz" ? "oz" : "lb")}>
              <option value="lb">lb</option>
              <option value="oz">oz</option>
            </select>
          </span>
        </label>
        <div className="row-3">
          <label>
            Length (in)
            <input type="number" min={0} step="0.1" value={lengthIn} onChange={(e) => setLengthIn(e.target.value)} />
          </label>
          <label>
            Width (in)
            <input type="number" min={0} step="0.1" value={widthIn} onChange={(e) => setWidthIn(e.target.value)} />
          </label>
          <label>
            Height (in)
            <input type="number" min={0} step="0.1" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
          </label>
        </div>
        <button className="btn btn-bronze" type="button" onClick={send} disabled={busy}>
          {busy ? "Working…" : "Email payment link"}
        </button>
      </div>
      {note ? <p className={noteBad ? "err" : "ok"}>{note}</p> : null}

      <h2>Payment links</h2>
      {!visible.length ? (
        <p>{quotes.length ? "Every payment link is archived. Search them under Order history." : "No payment links yet."}</p>
      ) : null}
      {visible.map((quote) => {
        const state = quotePayable(quote.status, quote.createdAt);
        return (
          <div key={quote.id} id={`inbox-pay-${quote.id}`} className="quote-item">
            <strong>{quote.title}</strong> · {formatUsd(quote.amountCents)}
            <p>
              {quote.name || "No name"} · {quote.email}
            </p>
            {quote.detail ? <p style={{ whiteSpace: "pre-wrap" }}>{quote.detail}</p> : null}
            <p className="muted">
              {quote.lengthIn} × {quote.widthIn} × {quote.heightIn} in · {weightLabel(quote.weightOz)} ·{" "}
              {orderWhen(quote.createdAt)} · {statusLabel(quote)}
            </p>
            <button type="button" onClick={() => copyLink(quote)} disabled={busy}>
              Copy link
            </button>
            {state === "open" ? (
              <button type="button" onClick={() => resend(quote)} disabled={busy}>
                Email the link again
              </button>
            ) : null}
            {state === "open" ? (
              <button type="button" onClick={() => cancelQuote(quote)} disabled={busy || archiveId === quote.id}>
                Cancel link
              </button>
            ) : null}
            <button type="button" onClick={() => archive(quote)} disabled={busy || archiveId === quote.id}>
              {archiveId === quote.id ? "Archiving…" : "Archive"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
