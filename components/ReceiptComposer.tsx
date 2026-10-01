"use client";

import { useState } from "react";
import { receiptEmailText, type ReceiptOrder } from "@/lib/receipt";

type Preview = ReceiptOrder & { logoUrl: string; to: string };

export function ReceiptComposer({
  orderId,
  email,
  receiptEmailedAt,
  onSent,
}: {
  orderId: string;
  email: string;
  receiptEmailedAt?: string;
  onSent: (sentAt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [bad, setBad] = useState(false);

  async function load() {
    setLoading(true);
    setNote("");
    setBad(false);
    try {
      const res = await fetch(`/api/master/order-receipt?orderId=${encodeURIComponent(orderId)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.receipt) {
        setBad(true);
        setNote(json.error || "Could not load the receipt.");
        return;
      }
      setPreview({
        ...json.receipt,
        logoUrl: typeof json.logoUrl === "string" ? json.logoUrl : "",
        to: typeof json.to === "string" && json.to ? json.to : email,
      });
      setOpen(true);
    } catch {
      setBad(true);
      setNote("Could not reach the server. Refresh before trying again.");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!preview) return;
    setSending(true);
    setNote("");
    setBad(false);
    let again = false;
    try {
      for (;;) {
        const res = await fetch("/api/master/order-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, comment, again }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.status === 409 && json.already && !again) {
          const ok = window.confirm(json.error || "Send this receipt again?");
          if (!ok) {
            setBad(true);
            setNote(json.error || "Already sent.");
            return;
          }
          again = true;
          continue;
        }
        if (!res.ok || !json.ok) {
          setBad(true);
          setNote(json.error || "The receipt was not sent.");
          if (json.receiptEmailedAt) onSent(json.receiptEmailedAt);
          return;
        }
        onSent(json.receiptEmailedAt);
        setNote("Receipt emailed to the customer.");
        return;
      }
    } catch {
      setBad(true);
      setNote("Could not reach the server. Refresh before trying again.");
    } finally {
      setSending(false);
    }
  }

  const text = preview ? receiptEmailText({ ...preview, comment }) : "";

  return (
    <div>
      <button type="button" className="btn" onClick={() => void load()} disabled={loading || sending || !email}>
        {loading ? "Loading…" : open ? "Refresh preview" : "Preview receipt"}
      </button>
      {open && preview ? (
        <div style={{ marginTop: 12, maxWidth: 520 }}>
          <p className="muted">This goes to {preview.to}. Nothing is emailed until you send it.</p>
          {preview.logoUrl ? (
            <img
              src={preview.logoUrl}
              alt="Big Horn Custom Works"
              width={180}
              style={{ display: "block", width: 180, height: "auto", margin: "8px auto" }}
            />
          ) : null}
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#f6efe4",
              color: "#1c1915",
              padding: 12,
              border: "1px solid #e4d7c3",
              fontFamily: "Georgia, serif",
            }}
          >
            {text}
          </pre>
          <label>
            Note on this receipt
            <textarea
              value={comment}
              maxLength={800}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional. A thank-you, a fit note, or anything else you want on this copy."
              style={{ minHeight: 80 }}
            />
          </label>
          <p>
            <button type="button" className="btn" onClick={() => void send()} disabled={sending || !email}>
              {sending ? "Sending…" : receiptEmailedAt ? "Send receipt again" : "Send receipt"}
            </button>
          </p>
        </div>
      ) : null}
      {note ? <p className={bad ? "err" : "ok"}>{note}</p> : null}
    </div>
  );
}
