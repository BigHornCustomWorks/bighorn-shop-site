"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatUsd } from "@/lib/money";
import { estimateSign, inchLabel, unitLabel } from "@/lib/sign-price";
import type { MetalSignsConfig } from "@/lib/types";

export function SignEstimator({
  config,
  shippingNote,
}: {
  config: MetalSignsConfig;
  shippingNote: string;
}) {
  const [width, setWidth] = useState("12");
  const [height, setHeight] = useState("12");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const quote = useMemo(() => estimateSign(config, width, height), [config, width, height]);
  const unit = unitLabel(config.unit);
  const rateReady = config.rateCents > 0 && config.visible;

  // Live Shippo rates for the packed sign. With no key or no ship-from the
  // probe answers "flat" and this widget behaves exactly as before.
  const [liveMode, setLiveMode] = useState<"idle" | "ready" | "live" | "flat">("idle");
  const [zip, setZip] = useState("");
  const [rates, setRates] = useState<{ id: string; displayName: string; amountCents: number; days: number }[]>([]);
  const [shipmentId, setShipmentId] = useState("");
  const [picked, setPicked] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  const [rateNote, setRateNote] = useState("");
  const sizeKey = quote.ok ? `${quote.widthIn}x${quote.heightIn}` : "";

  useEffect(() => {
    setRates([]);
    setPicked("");
    setShipmentId("");
    setRateNote("");
    if (!sizeKey || !quote.ok) {
      setLiveMode("idle");
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sign: { widthIn: quote.widthIn, heightIn: quote.heightIn } }),
      })
        .then((res) => res.json())
        .then((json) => live && setLiveMode(json.mode === "ready" ? "ready" : "flat"))
        .catch(() => live && setLiveMode("flat"));
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeKey]);

  async function getRates() {
    if (!quote.ok) return;
    setRateBusy(true);
    setRateNote("");
    try {
      const res = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sign: { widthIn: quote.widthIn, heightIn: quote.heightIn }, address: { zip } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRateNote(json.error || "Could not get rates.");
      } else if (json.mode === "live" && Array.isArray(json.rates) && json.rates.length) {
        setRates(json.rates);
        setShipmentId(json.shipmentId);
        setPicked(json.rates[0].id);
        setLiveMode("live");
      } else {
        setLiveMode("flat");
        setRateNote("Live rates are not available right now — size-based shipping applies on the payment page.");
      }
    } catch {
      setLiveMode("flat");
      setRateNote("Live rates are not available right now — size-based shipping applies on the payment page.");
    } finally {
      setRateBusy(false);
    }
  }

  const chosen = rates.find((r) => r.id === picked);
  const needsRate = liveMode === "ready" || (liveMode === "live" && !chosen);

  async function pay() {
    if (!quote.ok) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sign: { widthIn: quote.widthIn, heightIn: quote.heightIn },
          shipping: chosen ? { shipmentId, rateId: chosen.id } : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && json.code === "rate_invalid") {
        setRates([]);
        setPicked("");
        setLiveMode("ready");
      }
      if (!res.ok || !json.url) throw new Error(json.error || "Checkout is not ready.");
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setBusy(false);
    }
  }

  return (
    <div className="sign-estimator">
      <div className="card sign-estimator-form">
        <p className="section-kicker">Size &amp; price</p>
        <h2>Get an estimate</h2>
        <p className="note">
          Width × height of the finished sign, in inches. Rate is {rateReady ? `${formatUsd(config.rateCents)} / ${unit}` : "set in Master Control"}.
        </p>
        <div className="row">
          <label>
            Width (inches)
            <input
              inputMode="decimal"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="12"
            />
          </label>
          <label>
            Height (inches)
            <input
              inputMode="decimal"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="12"
            />
          </label>
        </div>
        <p className="muted">
          Allowed size: {inchLabel(config.minWidthIn)}–{inchLabel(config.maxWidthIn)} in wide ×{" "}
          {inchLabel(config.minHeightIn)}–{inchLabel(config.maxHeightIn)} in tall
          {config.minCents > 0 ? ` · minimum ${formatUsd(config.minCents)}` : ""}.
        </p>
      </div>

      <div className="sign-price-box">
        <p className="section-kicker kicker-spark">Estimate</p>
        {quote.ok ? (
          <>
            <p className="price">
              {formatUsd(liveMode === "ready" || liveMode === "live" ? quote.cents + (chosen?.amountCents || 0) : quote.totalCents)}
            </p>
            <p>
              {inchLabel(quote.widthIn)} × {inchLabel(quote.heightIn)} in · {quote.areaLabel}
            </p>
            <p className="muted">
              Sign {formatUsd(quote.cents)}
              {quote.minApplied ? " (minimum applied)" : ""} ·{" "}
              {chosen
                ? `${chosen.displayName} ${formatUsd(chosen.amountCents)}`
                : liveMode === "ready" || liveMode === "live"
                  ? "shipping: enter your ZIP"
                  : quote.shippingLabel}
            </p>
            {liveMode === "ready" || liveMode === "live" ? (
              <div className="form" style={{ marginTop: 8 }}>
                <label>
                  Ship-to ZIP for live USPS/UPS rates
                  <span style={{ display: "flex", gap: 6 }}>
                    <input value={zip} inputMode="numeric" maxLength={10} onChange={(e) => setZip(e.target.value)} />
                    <button type="button" className="btn-ghost" onClick={getRates} disabled={rateBusy || !zip.trim()}>
                      {rateBusy ? "Getting rates…" : "See rates"}
                    </button>
                  </span>
                </label>
                {rates.map((r) => (
                  <label key={r.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="radio" name="sign-rate" checked={picked === r.id} onChange={() => setPicked(r.id)} />
                    <span>
                      {r.displayName} — <strong>{formatUsd(r.amountCents)}</strong>
                      {r.days ? <span className="muted"> · about {r.days} business day{r.days === 1 ? "" : "s"}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
            {rateNote ? <p className="note">{rateNote}</p> : null}
            <p className="muted">{quote.rateLabel}</p>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-spark" type="button" onClick={pay} disabled={busy || needsRate}>
                {busy ? "Opening Stripe…" : needsRate ? "Enter your ZIP for shipping" : "Pay this estimate"}
              </button>
            </div>
            <p className="note" style={{ marginTop: 12 }}>
              On Stripe you can ship ({liveMode === "ready" || liveMode === "live" ? "the rate picked above" : "size-based postage"}) or
              choose local pickup in Sheridan at $0. {shippingNote}
            </p>
          </>
        ) : (
          <>
            <p className="price">—</p>
            <p>{quote.error}</p>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <Link className="btn btn-spark" href="/custom">
                Request a quote
              </Link>
            </div>
          </>
        )}
        {error ? <p className="err">{error}</p> : null}
      </div>
    </div>
  );
}
