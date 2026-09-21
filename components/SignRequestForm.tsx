"use client";

import { useMemo, useState } from "react";
import { formatUsd } from "@/lib/money";
import { estimateSign, inchLabel, visibleFinishes } from "@/lib/sign-price";
import type { MetalSignsConfig } from "@/lib/types";

export function SignRequestForm({
  config,
  pickupEnabled,
  pickupLabel,
  sampleUrl,
  onClearSample,
}: {
  config: MetalSignsConfig;
  pickupEnabled: boolean;
  pickupLabel: string;
  sampleUrl: string;
  onClearSample: () => void;
}) {
  const finishes = visibleFinishes(config);
  const [width, setWidth] = useState("12");
  const [height, setHeight] = useState("12");
  const [finishId, setFinishId] = useState(finishes[0]?.id || "");
  const [fulfillment, setFulfillment] = useState<"pickup" | "ship">(pickupEnabled ? "pickup" : "ship");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");
  const [payBusy, setPayBusy] = useState(false);

  const quote = useMemo(
    () => estimateSign(config, width, height, { finishId, fulfillment }),
    [config, width, height, finishId, fulfillment],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("kind", "sign");
    data.set("sampleUrl", sampleUrl);
    data.set("widthIn", width);
    data.set("heightIn", height);
    data.set("finishName", finishes.find((f) => f.id === finishId)?.name || "");
    data.set("fulfillment", fulfillment === "pickup" ? "Local pickup — no shipping" : "Ship");
    data.set("estimateLabel", quote.ok ? formatUsd(quote.totalCents) : "not posted");
    try {
      const res = await fetch("/api/quote", { method: "POST", body: data });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not send.");
      setStatus("ok");
      setMessage("Got it. Clint will get back to you from the shop.");
      form.reset();
    } catch (err) {
      setStatus("err");
      setMessage(err instanceof Error ? err.message : "Could not send. Email bighorncustomworks@gmail.com.");
    }
  }

  async function pay() {
    if (!quote.ok) return;
    setPayBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sign: {
            widthIn: quote.widthIn,
            heightIn: quote.heightIn,
            finishId,
            pickup: fulfillment === "pickup",
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error || "Checkout is not ready.");
      window.location.href = json.url;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed.");
      setPayBusy(false);
    }
  }

  return (
    <form id="sign-request" className="form sign-request" onSubmit={onSubmit}>
      {sampleUrl ? (
        <div className="sign-picked">
          <img src={sampleUrl} alt="Selected sample" />
          <p>
            Based on this sample. Enter the size you want.
            <button type="button" className="btn" onClick={onClearSample}>
              Clear
            </button>
          </p>
        </div>
      ) : null}

      <label>
        Describe the sign
        <textarea
          name="need"
          required
          maxLength={4000}
          placeholder="Name, ranch brand, address plaque, wording, style…"
        />
      </label>

      <div className="row">
        <label>
          Width (inches)
          <input inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} required />
        </label>
        <label>
          Height (inches)
          <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} required />
        </label>
      </div>

      {finishes.length ? (
        <label>
          Finish
          <select value={finishId} onChange={(e) => setFinishId(e.target.value)}>
            {finishes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.extraCents > 0
                  ? ` (+${formatUsd(f.extraCents)}${f.extraKind === "flat" ? "" : " / sq ft"})`
                  : " (no extra)"}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <fieldset className="sign-fulfill">
        <legend>How do you want it?</legend>
        {pickupEnabled ? (
          <label className="radio">
            <input
              type="radio"
              name="how"
              checked={fulfillment === "pickup"}
              onChange={() => setFulfillment("pickup")}
            />
            Local pickup — no shipping
            {pickupLabel ? ` (${pickupLabel})` : ""}
          </label>
        ) : null}
        <label className="radio">
          <input
            type="radio"
            name="how"
            checked={fulfillment === "ship"}
            onChange={() => setFulfillment("ship")}
          />
          Ship from Sheridan (postage from size)
        </label>
      </fieldset>

      <div className="sign-price-box">
        <p className="section-kicker kicker-spark">Estimate</p>
        {quote.ok ? (
          <>
            <p className="price">{formatUsd(quote.totalCents)}</p>
            <p>
              {inchLabel(quote.widthIn)} × {inchLabel(quote.heightIn)} in · {quote.areaLabel}
            </p>
            <p className="muted">
              Sign {formatUsd(quote.cents - quote.finishCents)}
              {quote.finishCents > 0 ? ` · ${quote.finishName} ${formatUsd(quote.finishCents)}` : ` · ${quote.finishName}`}
              {" · "}
              {quote.shippingLabel}
            </p>
          </>
        ) : (
          <>
            <p className="price">—</p>
            <p>{quote.error}</p>
            <p className="muted">You can still send the request. Clint will quote it.</p>
          </>
        )}
      </div>

      <label>
        Name
        <input name="name" required maxLength={120} autoComplete="name" />
      </label>
      <label>
        Email
        <input name="email" type="email" required maxLength={160} autoComplete="email" />
      </label>
      <label>
        Phone
        <input name="phone" type="tel" maxLength={40} autoComplete="tel" />
      </label>
      <label>
        Your sketch or photo (optional)
        <input name="photo" type="file" accept="image/*" />
      </label>

      <div className="hero-actions">
        <button className="btn btn-bronze" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send custom sign request"}
        </button>
        {quote.ok ? (
          <button className="btn btn-spark" type="button" onClick={pay} disabled={payBusy}>
            {payBusy ? "Opening Stripe…" : fulfillment === "pickup" ? "Pay estimate — pickup" : "Pay estimate — ship"}
          </button>
        ) : null}
      </div>
      {message ? <p className={status === "ok" ? "ok" : "err"}>{message}</p> : null}
    </form>
  );
}
