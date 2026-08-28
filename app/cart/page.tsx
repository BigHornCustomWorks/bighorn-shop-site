"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { formatUsd } from "@/lib/money";

export default function CartPage() {
  const { lines, setQty, remove, totalCents, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            variant: l.variant,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || "Checkout is not ready.");
      clear();
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <p className="section-kicker">Cart</p>
      <h1>Your cart</h1>
      {!lines.length ? (
        <p>
          Cart is empty. <Link href="/shop">Shop parts</Link>
        </p>
      ) : (
        <>
          {lines.map((line) => (
            <div key={line.productId + line.variant} className="row" style={{ marginBottom: 12, alignItems: "center" }}>
              <div>
                <strong>{line.name}</strong>
                {line.variant ? <span className="muted"> · {line.variant}</span> : null}
                <div className="price">{formatUsd(line.priceCents)}</div>
              </div>
              <div>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={line.quantity}
                  onChange={(e) => setQty(line.productId, line.variant, Number(e.target.value) || 1)}
                />
                <button type="button" className="btn-ghost" onClick={() => remove(line.productId, line.variant)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          <p className="price">Total {formatUsd(totalCents)}</p>
          <p className="note">Shipping from Sheridan, WY is confirmed at checkout. Stripe handles the card and receipt.</p>
          <button className="btn" type="button" onClick={checkout} disabled={busy}>
            {busy ? "Opening Stripe…" : "Checkout with Stripe"}
          </button>
          {error ? <p className="err">{error}</p> : null}
        </>
      )}
    </div>
  );
}
