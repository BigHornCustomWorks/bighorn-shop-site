"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { formatUsd } from "@/lib/money";

type Rate = {
  id: string;
  carrier: string;
  service: string;
  displayName: string;
  amountCents: number;
  days: number;
};

type RatesState =
  | { mode: "idle" }
  | { mode: "none" | "flat" | "ready"; pickup: boolean }
  | { mode: "live"; pickup: boolean; shipmentId: string; rates: Rate[] };

export default function CartPage() {
  const { lines, setQty, remove, totalCents, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rates, setRates] = useState<RatesState>({ mode: "idle" });
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState("");
  const [picked, setPicked] = useState("");
  const [addr, setAddr] = useState({ street1: "", city: "", state: "", zip: "" });

  const cartRows = useMemo(
    () =>
      lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        variant: l.variant,
      })),
    [lines],
  );
  const cartKey = JSON.stringify(cartRows);

  // Any cart change invalidates quoted rates (the box changed). Re-probe
  // whether live rates apply; with no Shippo key this answers "flat" and
  // the page behaves exactly as it did before live rates existed.
  useEffect(() => {
    setPicked("");
    setRateError("");
    if (!cartRows.length) {
      setRates({ mode: "idle" });
      return;
    }
    let live = true;
    fetch("/api/shipping/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cartRows }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!live) return;
        const mode = json.mode === "none" || json.mode === "ready" ? json.mode : "flat";
        setRates({ mode, pickup: json.pickup !== false });
      })
      .catch(() => live && setRates({ mode: "flat", pickup: true }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

  async function getRates() {
    setRateBusy(true);
    setRateError("");
    setPicked("");
    try {
      const res = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartRows, address: addr }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRateError(json.error || "Could not get rates.");
        return;
      }
      if (json.mode === "live" && Array.isArray(json.rates) && json.rates.length) {
        setRates({ mode: "live", pickup: json.pickup !== false, shipmentId: json.shipmentId, rates: json.rates });
        setPicked(json.rates[0].id);
      } else {
        // API trouble or no rates: flat shipping on the Stripe page instead.
        setRates({ mode: "flat", pickup: json.pickup !== false });
        setRateError("Live rates are not available right now — standard shipping is chosen on the payment page.");
      }
    } catch {
      setRates({ mode: "flat", pickup: true });
      setRateError("Live rates are not available right now — standard shipping is chosen on the payment page.");
    } finally {
      setRateBusy(false);
    }
  }

  const needsRate = rates.mode === "ready" || (rates.mode === "live" && !picked);

  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const shipping =
        rates.mode === "live" && picked ? { shipmentId: rates.shipmentId, rateId: picked } : undefined;
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartRows, shipping }),
      });
      const json = await res.json();
      if (res.status === 409 && json.code === "rate_invalid") {
        setRates({ mode: "ready", pickup: rates.mode === "live" ? rates.pickup : true });
        setPicked("");
        throw new Error(json.error || "Shipping rates changed. Please get rates again.");
      }
      if (!res.ok || !json.url) throw new Error(json.error || "Checkout is not ready.");
      clear();
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setBusy(false);
    }
  }

  const showRateBox = rates.mode === "ready" || rates.mode === "live";
  const pickupOn = rates.mode !== "idle" && rates.pickup;
  const chosen = rates.mode === "live" ? rates.rates.find((r) => r.id === picked) : undefined;

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

          {showRateBox ? (
            <div className="form" style={{ maxWidth: 560, marginBottom: 16 }}>
              <p className="section-kicker">Shipping</p>
              <p className="note">
                Enter where it&apos;s going for live USPS and UPS rates from Sheridan, WY. ZIP is enough; the full
                street address makes the rate exact.
                {pickupOn ? " Picking up in Sheridan? Choose Local pickup on the payment page." : ""}
              </p>
              <label>
                Street (optional)
                <input
                  value={addr.street1}
                  autoComplete="shipping address-line1"
                  onChange={(e) => setAddr({ ...addr, street1: e.target.value })}
                />
              </label>
              <div className="row-3">
                <label>
                  City (optional)
                  <input
                    value={addr.city}
                    autoComplete="shipping address-level2"
                    onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                  />
                </label>
                <label>
                  State (optional)
                  <input
                    value={addr.state}
                    maxLength={2}
                    autoComplete="shipping address-level1"
                    onChange={(e) => setAddr({ ...addr, state: e.target.value.toUpperCase() })}
                  />
                </label>
                <label>
                  ZIP
                  <input
                    value={addr.zip}
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="shipping postal-code"
                    onChange={(e) => setAddr({ ...addr, zip: e.target.value })}
                  />
                </label>
              </div>
              <button className="btn-ghost" type="button" onClick={getRates} disabled={rateBusy || !addr.zip.trim()}>
                {rateBusy ? "Getting rates…" : rates.mode === "live" ? "Update rates" : "See shipping rates"}
              </button>
              {rates.mode === "live" ? (
                <div role="radiogroup" aria-label="Shipping service">
                  {rates.rates.map((r) => (
                    <label key={r.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="radio"
                        name="rate"
                        checked={picked === r.id}
                        onChange={() => setPicked(r.id)}
                      />
                      <span>
                        {r.displayName} — <strong>{formatUsd(r.amountCents)}</strong>
                        {r.days ? <span className="muted"> · about {r.days} business day{r.days === 1 ? "" : "s"}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {rateError ? <p className="note">{rateError}</p> : null}

          {chosen ? (
            <p className="price">
              With {chosen.displayName}: {formatUsd(totalCents + chosen.amountCents)} before tax
            </p>
          ) : (
            <p className="note">Shipping from Sheridan, WY is confirmed at checkout. Stripe handles the card and receipt.</p>
          )}
          <button className="btn" type="button" onClick={checkout} disabled={busy || needsRate}>
            {busy ? "Opening Stripe…" : needsRate ? "Enter your ZIP to see shipping" : "Checkout with Stripe"}
          </button>
          {error ? <p className="err">{error}</p> : null}
        </>
      )}
    </div>
  );
}
