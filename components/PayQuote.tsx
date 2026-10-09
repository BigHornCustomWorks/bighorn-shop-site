"use client";

import { useEffect, useState } from "react";
import { formatUsd } from "@/lib/money";

type Rate = {
  id: string;
  displayName: string;
  amountCents: number;
  days: number;
};

type RatesState =
  | { mode: "idle" }
  | { mode: "flat"; pickup: boolean; reason: string }
  | { mode: "ready"; pickup: boolean; reason: string }
  | { mode: "live"; pickup: boolean; reason: string; shipmentId: string; rates: Rate[] };

function reasonText(reason: string): string {
  if (reason === "no_rates") {
    return "USPS and UPS did not return a price for that ZIP. Shipping is confirmed at the shop's flat rate when you pay.";
  }
  if (reason === "api_error" || reason === "busy") {
    return "Carrier prices are unavailable right now. Shipping is confirmed at the shop's flat rate when you pay.";
  }
  return "Shipping is confirmed at the shop's flat rate when you pay.";
}

export function PayQuote({
  id,
  token,
  title,
  detail,
  amountCents,
  pickupEnabled,
}: {
  id: string;
  token: string;
  title: string;
  detail: string;
  amountCents: number;
  pickupEnabled: boolean;
}) {
  const [how, setHow] = useState<"ship" | "pickup">("ship");
  const [addr, setAddr] = useState({ street1: "", city: "", state: "", zip: "" });
  const [rates, setRates] = useState<RatesState>({ mode: "idle" });
  const [picked, setPicked] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/shipping/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentQuote: { id, token } }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!live) return;
        if (json.mode === "ready") {
          setRates({ mode: "ready", pickup: json.pickup === true, reason: "" });
          return;
        }
        setRates({
          mode: "flat",
          pickup: json.pickup === true,
          reason: typeof json.reason === "string" ? json.reason : "no_rates",
        });
      })
      .catch(() => {
        if (live) setRates({ mode: "flat", pickup: pickupEnabled, reason: "api_error" });
      });
    return () => {
      live = false;
    };
  }, [id, token, pickupEnabled]);

  async function getRates() {
    if (!addr.zip.trim()) {
      setRateError("Enter a ZIP code, then click See shipping rates.");
      return;
    }
    setRateBusy(true);
    setRateError("");
    setPicked("");
    try {
      const res = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentQuote: { id, token }, address: addr }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRateError(json.error || "Could not get rates.");
        return;
      }
      if (json.mode === "live" && Array.isArray(json.rates) && json.rates.length) {
        setRates({
          mode: "live",
          pickup: json.pickup === true,
          reason: "",
          shipmentId: String(json.shipmentId || ""),
          rates: json.rates,
        });
        return;
      }
      const reason = typeof json.reason === "string" ? json.reason : "no_rates";
      setRates({ mode: "flat", pickup: json.pickup === true, reason });
      setRateError(reasonText(reason));
    } catch {
      setRates({ mode: "flat", pickup: pickupEnabled, reason: "api_error" });
      setRateError(reasonText("api_error"));
    } finally {
      setRateBusy(false);
    }
  }

  const pickupOn = rates.mode !== "idle" && rates.pickup && pickupEnabled;
  const shipChosen = !pickupOn || how === "ship";
  const needsRate = shipChosen && (rates.mode === "ready" || rates.mode === "idle" || (rates.mode === "live" && !picked));
  const chosen = rates.mode === "live" && shipChosen ? rates.rates.find((rate) => rate.id === picked) : undefined;

  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const shipping =
        shipChosen && rates.mode === "live" && picked
          ? { shipmentId: rates.shipmentId, rateId: picked }
          : undefined;
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentQuote: { id, token },
          fulfillment: shipChosen ? "ship" : "pickup",
          shipping,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && json.code === "rate_invalid") {
        setRates({ mode: "ready", pickup: pickupOn, reason: "" });
        setPicked("");
        throw new Error(json.error || "Shipping rates changed. Please get rates again.");
      }
      if (!res.ok || !json.url) throw new Error(json.error || "Checkout is not ready.");
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <p className="section-kicker">Big Horn Custom Works</p>
      <h1>{title}</h1>
      {detail ? <p style={{ whiteSpace: "pre-wrap" }}>{detail}</p> : null}
      <p className="price">{formatUsd(amountCents)}</p>
      <p className="note">This price is the quote. Shipping and sales tax are added when you pay.</p>

      <section className="ship-card" aria-label="Shipping">
        <h2>Shipping</h2>
        {rates.mode === "idle" ? <p className="note">Checking shipping…</p> : null}
        {rates.mode !== "idle" ? (
          <fieldset className="sign-fulfill">
            <legend>How do you want it?</legend>
            <label className="radio">
              <input type="radio" name="pay-how" checked={how === "ship" || !pickupOn} onChange={() => setHow("ship")} />
              Ship it
            </label>
            {pickupOn ? (
              <label className="radio">
                <input type="radio" name="pay-how" checked={how === "pickup"} onChange={() => setHow("pickup")} />
                Pick up in Sheridan, WY (free)
              </label>
            ) : null}
          </fieldset>
        ) : null}

        {shipChosen && rates.mode !== "idle" ? (
          <div className="form">
            <p className="note">ZIP is enough for a quote. A street address makes the price exact.</p>
            {rates.mode === "flat" ? <p className="note">{reasonText(rates.reason)}</p> : null}
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
                ZIP code
                <input
                  value={addr.zip}
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="shipping postal-code"
                  onChange={(e) => setAddr({ ...addr, zip: e.target.value })}
                />
              </label>
            </div>
            <button className="btn btn-bronze ship-rate-btn" type="button" onClick={getRates} disabled={rateBusy}>
              {rateBusy ? "Getting rates…" : rates.mode === "live" ? "Update shipping rates" : "See shipping rates"}
            </button>
            {rates.mode === "live" ? (
              <div role="radiogroup" aria-label="Shipping service">
                {rates.rates.map((rate) => (
                  <label key={rate.id} className="radio">
                    <input type="radio" name="pay-rate" checked={picked === rate.id} onChange={() => setPicked(rate.id)} />
                    <span>
                      {rate.displayName} — <strong>{formatUsd(rate.amountCents)}</strong>
                      {rate.days ? (
                        <span className="muted">
                          {" "}
                          · about {rate.days} business day{rate.days === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
            {rateError ? (
              <p className="note" role="alert">
                {rateError}
              </p>
            ) : null}
          </div>
        ) : null}
        {!shipChosen ? <p className="note">Pickup in Sheridan is free. You pay the quote, plus sales tax if it applies.</p> : null}
      </section>

      {chosen ? (
        <p className="price">
          With {chosen.displayName}: {formatUsd(amountCents + chosen.amountCents)} before tax
        </p>
      ) : null}

      <button className="btn btn-bronze" type="button" onClick={checkout} disabled={busy || needsRate}>
        {busy ? "Opening Stripe…" : needsRate ? "See shipping rates above" : "Pay with Stripe"}
      </button>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
