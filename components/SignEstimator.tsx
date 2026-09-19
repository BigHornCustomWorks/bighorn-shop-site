"use client";

import { useMemo, useState } from "react";
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

  async function pay() {
    if (!quote.ok) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sign: { widthIn: quote.widthIn, heightIn: quote.heightIn } }),
      });
      const json = await res.json().catch(() => ({}));
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
            <p className="price">{formatUsd(quote.totalCents)}</p>
            <p>
              {inchLabel(quote.widthIn)} × {inchLabel(quote.heightIn)} in · {quote.areaLabel}
            </p>
            <p className="muted">
              Sign {formatUsd(quote.cents)}
              {quote.minApplied ? " (minimum applied)" : ""} · {quote.shippingLabel}
            </p>
            <p className="muted">{quote.rateLabel}</p>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-spark" type="button" onClick={pay} disabled={busy}>
                {busy ? "Opening Stripe…" : "Pay this estimate"}
              </button>
            </div>
            <p className="note" style={{ marginTop: 12 }}>
              On Stripe you can ship (size-based postage) or choose local pickup in Sheridan at $0. {shippingNote}
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
