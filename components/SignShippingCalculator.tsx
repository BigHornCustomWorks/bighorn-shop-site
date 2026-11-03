"use client";

import { useState } from "react";
import { formatUsd } from "@/lib/money";

type Rate = { id: string; displayName: string; amountCents: number; days: number };
type Fallback = { label: string; amountCents: number; minDays: number; maxDays: number };
type Parcel = { length: number; width: number; height: number; weight: number };

/**
 * Shipping-only estimate for a metal sign: size + ZIP in, carrier prices out.
 * Works for any made sign (in stock or custom), with no price or checkout.
 */
export function SignShippingCalculator({
  pickupEnabled,
  pickupLabel,
}: {
  pickupEnabled: boolean;
  pickupLabel: string;
}) {
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rates, setRates] = useState<Rate[]>([]);
  const [fallback, setFallback] = useState<Fallback[]>([]);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [done, setDone] = useState(false);

  async function estimate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setRates([]);
    setFallback([]);
    setParcel(null);
    setDone(false);
    try {
      const res = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signShip: { widthIn: width, heightIn: height }, address: { zip } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not estimate shipping. Try again.");
        return;
      }
      setParcel(json.parcel || null);
      if (json.mode === "live" && Array.isArray(json.rates) && json.rates.length) {
        setRates([...json.rates].sort((a: Rate, b: Rate) => a.amountCents - b.amountCents));
      } else {
        setFallback(Array.isArray(json.fallback) ? json.fallback : []);
      }
      setDone(true);
    } catch {
      setError("Could not estimate shipping. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const days = (min: number, max: number) =>
    min > 0 && max > 0 ? ` · ${min === max ? min : `${min}–${max}`} business days` : "";

  return (
    <section id="shipping-calculator" className="card ship-calc" style={{ marginTop: 28 }}>
      <p className="section-kicker">Signs only</p>
      <h2>Sign shipping calculator</h2>
      <p className="muted">
        Enter the sign size and your ZIP code to see what shipping costs. Works for signs in stock and custom signs.
        This is an estimate only; nothing is charged here.
      </p>
      <form className="form" onSubmit={estimate}>
        <div className="ship-calc-fields">
          <label>
            Sign width (inches)
            <input inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="19" required />
          </label>
          <label>
            Sign height (inches)
            <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="19" required />
          </label>
          <label>
            Ship-to ZIP
            <input
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={10}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="82801"
              required
            />
          </label>
        </div>
        <button className="btn btn-spark" type="submit" disabled={busy}>
          {busy ? "Checking carriers…" : "Estimate shipping"}
        </button>
      </form>

      {error ? <p className="err">{error}</p> : null}

      {done ? (
        <div className="ship-calc-result" aria-live="polite">
          {rates.length ? (
            <>
              <p className="section-kicker kicker-spark">Live USPS / UPS rates</p>
              <ul className="ship-calc-rates">
                {rates.map((r) => (
                  <li key={r.id}>
                    <span>
                      {r.displayName}
                      {r.days ? <span className="muted"> · about {r.days} business day{r.days === 1 ? "" : "s"}</span> : null}
                    </span>
                    <strong>{formatUsd(r.amountCents)}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : fallback.length ? (
            <>
              <p className="section-kicker kicker-spark">Shipping</p>
              <ul className="ship-calc-rates">
                {fallback.map((f, i) => (
                  <li key={i}>
                    <span>
                      {f.label}
                      <span className="muted">{days(f.minDays, f.maxDays)}</span>
                    </span>
                    <strong>{formatUsd(f.amountCents)}</strong>
                  </li>
                ))}
              </ul>
              <p className="note">Live carrier prices are not available right now, so this is our standard rate.</p>
            </>
          ) : (
            <p className="note">
              We could not price this one automatically. <a href="/contact">Contact us</a> and we will quote shipping.
            </p>
          )}
          {parcel ? (
            <p className="muted">
              Packed size about {parcel.length} × {parcel.width} × {parcel.height} in, {(parcel.weight / 16).toFixed(1)} lb.
            </p>
          ) : null}
          {pickupEnabled ? <p className="muted">{pickupLabel}: no shipping charge.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
