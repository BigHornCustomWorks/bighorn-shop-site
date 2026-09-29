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
  | { mode: "none"; pickup: boolean; reason: string }
  | { mode: "flat"; pickup: boolean; reason: string }
  | { mode: "ready"; pickup: boolean; reason: string }
  | { mode: "live"; pickup: boolean; reason: string; shipmentId: string; rates: Rate[] };

function reasonText(reason: string): string {
  switch (reason) {
    case "no_rates":
      return "USPS and UPS did not return a price for that ZIP. This order ships at the flat rate.";
    case "api_error":
    case "busy":
      return "Carrier prices are unavailable right now. This order ships at the flat rate.";
    default:
      return "This order ships at the shop's flat rate. The shipping price is confirmed when you pay.";
  }
}

function ratesNeedSetup(reason: string): boolean {
  return reason === "not_configured" || reason === "no_ship_from";
}

function nameList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((name): name is string => typeof name === "string" && name.trim().length > 0);
}

function missingSizeNote(names: string[]): string {
  if (!names.length) {
    return "This order ships at the shop's flat rate until every item has a shipping size saved. The shipping price is confirmed when you pay.";
  }
  return `This order ships at the shop's flat rate until these items have a shipping size saved: ${names.join(", ")}. The shipping price is confirmed when you pay.`;
}

export default function CartPage() {
  const { lines, setQty, remove, totalCents, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rates, setRates] = useState<RatesState>({ mode: "idle" });
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState("");
  const [picked, setPicked] = useState("");
  const [how, setHow] = useState<"ship" | "pickup">("ship");
  const [addr, setAddr] = useState({ street1: "", city: "", state: "", zip: "" });
  const [unmeasured, setUnmeasured] = useState<string[]>([]);

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
      setUnmeasured([]);
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
        const reason = typeof json.reason === "string" ? json.reason : "";
        setUnmeasured(nameList(json.unmeasured));
        setRates({ mode, pickup: json.pickup === true, reason });
      })
      .catch(() => live && setRates({ mode: "flat", pickup: false, reason: "api_error" }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

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
        body: JSON.stringify({ items: cartRows, address: addr }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRateError(json.error || "Could not get rates.");
        return;
      }
      if (json.mode === "live" && Array.isArray(json.rates) && json.rates.length) {
        setUnmeasured([]);
        setRates({
          mode: "live",
          pickup: json.pickup === true,
          reason: "",
          shipmentId: json.shipmentId,
          rates: json.rates,
        });
        setPicked("");
      } else {
        const reason = typeof json.reason === "string" ? json.reason : "no_rates";
        const names = nameList(json.unmeasured);
        setUnmeasured(names);
        setRates({ mode: "flat", pickup: json.pickup === true, reason });
        setRateError(reason === "missing_dimensions" ? "" : reasonText(reason));
      }
    } catch {
      setRates({ mode: "flat", pickup: false, reason: "api_error" });
      setRateError(reasonText("api_error"));
    } finally {
      setRateBusy(false);
    }
  }

  const pickupOn = rates.mode !== "idle" && rates.mode !== "none" && rates.pickup;
  const shipChosen = !pickupOn || how === "ship";
  const needsRate = shipChosen && (rates.mode === "ready" || (rates.mode === "live" && !picked));

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
          items: cartRows,
          fulfillment: shipChosen ? "ship" : "pickup",
          shipping,
        }),
      });
      const json = await res.json();
      if (res.status === 409 && json.code === "rate_invalid") {
        setRates({ mode: "ready", pickup: "pickup" in rates && rates.pickup === true, reason: "" });
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

  const setupGap = rates.mode === "flat" && ratesNeedSetup(rates.reason);
  const showRateBox = shipChosen && !setupGap && rates.mode !== "idle" && rates.mode !== "none";
  const chosen = rates.mode === "live" && shipChosen ? rates.rates.find((r) => r.id === picked) : undefined;
  const flatNote = rates.mode === "flat" && shipChosen && !showRateBox ? reasonText(rates.reason) : "";

  return (
    <div className="wrap">
      <p className="section-kicker">Cart</p>
      <h1>Your cart</h1>
      {!lines.length ? (
        <p>
          Cart is empty.{" "}
          <Link href="/physical">Continue shopping</Link>
          {" · "}
          <Link href="/signs">Signs</Link>
        </p>
      ) : (
        <>
          {rates.mode !== "none" ? (
            <section className="ship-card" aria-label="Shipping">
              <h2>Shipping</h2>
              {rates.mode === "idle" ? <p className="note">Checking shipping…</p> : null}
              {rates.mode !== "idle" ? (
                <fieldset className="sign-fulfill">
                  <legend>How do you want it?</legend>
                  <label className="radio">
                    <input type="radio" name="cart-how" checked={how === "ship" || !pickupOn} onChange={() => setHow("ship")} />
                    Ship it
                  </label>
                  {pickupOn ? (
                    <label className="radio">
                      <input type="radio" name="cart-how" checked={how === "pickup"} onChange={() => setHow("pickup")} />
                      Pick up in Sheridan, WY (free)
                    </label>
                  ) : null}
                </fieldset>
              ) : null}
              {showRateBox ? (
                <div className="form">
                  <p className="note">
                    Enter where it is going. ZIP is enough for a quote. A street address makes the price exact.
                  </p>
                  {"reason" in rates && rates.reason === "missing_dimensions" ? (
                    <p className="note">{missingSizeNote(unmeasured)}</p>
                  ) : null}
                  {"reason" in rates && rates.mode === "flat" && rates.reason !== "missing_dimensions" ? (
                    <p className="note">{reasonText(rates.reason)}</p>
                  ) : null}
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
                      {rates.rates.map((r) => (
                        <label key={r.id} className="radio">
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
                  {rateError ? <p className="note">{rateError}</p> : null}
                </div>
              ) : null}
              {flatNote && !rateError ? <p className="note">{flatNote}</p> : null}
            </section>
          ) : null}

          {lines.map((line) => (
            <div key={line.productId + line.variant} className="row" style={{ marginBottom: 12, alignItems: "center" }}>
              <div>
                <strong>{line.name}</strong>
                {line.variant ? <span className="muted"> · {line.variant}</span> : null}
                <div className="price">{formatUsd(line.priceCents)}</div>
                {line.slug ? (
                  <p className="muted">
                    <Link href={`/shop/${line.slug}`}>Add another size / finish of this item</Link>
                  </p>
                ) : null}
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

          {chosen ? (
            <p className="price">
              With {chosen.displayName}: {formatUsd(totalCents + chosen.amountCents)} before tax
            </p>
          ) : (
            <p className="note">Shipping from Sheridan, WY is confirmed at checkout. Stripe handles the card and receipt.</p>
          )}
          <div className="hero-actions">
            <button className="btn btn-bronze" type="button" onClick={checkout} disabled={busy || needsRate}>
              {busy ? "Opening Stripe…" : needsRate ? "See shipping rates above" : "Checkout with Stripe"}
            </button>
            <Link className="btn" href={lines.find((l) => l.shopHref)?.shopHref || "/physical"}>
              Continue shopping
            </Link>
            <Link className="btn" href="/signs">
              Order more signs
            </Link>
            <Link className="btn" href="/physical">
              More physical products
            </Link>
          </div>
          {error ? <p className="err">{error}</p> : null}
        </>
      )}
    </div>
  );
}
