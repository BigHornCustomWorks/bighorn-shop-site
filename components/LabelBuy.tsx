"use client";

import { useState } from "react";
import { formatUsd } from "@/lib/money";
import type { ShopOrder } from "@/lib/types";

type ConfirmQuote = {
  shipmentId: string;
  rateId: string;
  carrier: string;
  service: string;
  oldCents: number;
  newCents: number;
  sameService: boolean;
  reason: string;
};

function filledAddress(order: ShopOrder): string {
  const ship = order.shipTo;
  if (!ship?.street1) return (order.address || "").trim();
  return [
    ship.name || order.name,
    ship.street1,
    ship.street2,
    [ship.city, ship.state, ship.zip].filter(Boolean).join(", "),
    ship.phone || order.phone || "",
  ]
    .map((line) => (line || "").trim())
    .filter(Boolean)
    .join("\n");
}

function plainError(error: string): string {
  if (/complete address/i.test(error)) {
    return "The first quote was missing the customer name, so the carrier would not sell that label. Buy label uses the full address below.";
  }
  return error;
}

/**
 * Buys the postage the customer already paid for, using the address stored
 * on the order, then opens the 4×6 PDF to print.
 */
export function LabelBuy({
  order,
  onBought,
}: {
  order: ShopOrder;
  onBought: (fields: Partial<ShopOrder>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [bad, setBad] = useState(false);
  const [quote, setQuote] = useState<ConfirmQuote | null>(null);
  const canBuy = order.paymentStatus === "paid" && Boolean(order.rateId && order.rateShipmentId) && !order.labelUrl;
  if (!canBuy && !order.labelUrl) return null;

  const service = [order.rateCarrier, order.rateService].filter(Boolean).join(" ") || order.shippingLabel || "the service they chose";
  const paid = order.rateCents || order.shippingCents || 0;
  const address = filledAddress(order);

  async function buy(confirm?: { shipmentId: string; rateId: string }) {
    const tab = window.open("", "_blank");
    setBusy(true);
    setNote("");
    setBad(false);
    try {
      const res = await fetch("/api/master/order-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, confirm }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.needsConfirm && json.quote) {
        tab?.close();
        setQuote(json.quote);
        setBad(false);
        setNote("The price changed. Check it below, then click Buy.");
        return;
      }
      if (!res.ok || !json.ok) {
        tab?.close();
        setBad(true);
        setNote(plainError(json.error || "Could not buy the label."));
        return;
      }
      setQuote(null);
      if (json.order) onBought(json.order);
      const url = json.order?.labelUrl || json.label?.labelUrl || "";
      if (url && tab) tab.location.href = url;
      else tab?.close();
      setBad(Boolean(json.storageWarning));
      setNote(
        json.storageWarning ||
          (url
            ? "Label bought. The PDF is open in a new window — print it from there."
            : "Label bought. Use Print label if the PDF did not open."),
      );
    } catch {
      tab?.close();
      setBad(true);
      setNote("Could not reach the server. Refresh before trying again.");
    } finally {
      setBusy(false);
    }
  }

  function printLabel() {
    if (!order.labelUrl) return;
    window.open(order.labelUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mc-label">
      <p className="mc-sale-kicker">Shipping label</p>
      {order.labelUrl ? (
        <>
          <h3>Ready to print</h3>
          <p>
            {order.labelCarrier} {order.labelService}
            {order.labelCents ? ` · ${formatUsd(order.labelCents)}` : ""}
            {order.trackingNumber ? ` · ${order.trackingNumber}` : ""}
          </p>
          <div className="hero-actions">
            <button type="button" className="btn btn-bronze" onClick={printLabel}>
              Print label
            </button>
            {order.labelTrackingUrl ? (
              <a className="btn" href={order.labelTrackingUrl} target="_blank" rel="noopener noreferrer">
                Tracking page
              </a>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <h3>
            {service}
            {paid ? ` · ${formatUsd(paid)}` : ""}
          </h3>
          <p>The customer already paid this postage. The address below is filled in from their order.</p>
          {address ? <p style={{ whiteSpace: "pre-wrap" }}>{address}</p> : <p className="err">No shipping address is saved on this order.</p>}
          {quote ? (
            <div className="banner">
              <p>
                {quote.reason} New price: <strong>{formatUsd(quote.newCents)}</strong> for {quote.carrier} {quote.service}{" "}
                (customer paid {formatUsd(quote.oldCents)}
                {quote.newCents !== quote.oldCents
                  ? `, ${quote.newCents > quote.oldCents ? "+" : "−"}${formatUsd(Math.abs(quote.newCents - quote.oldCents))}`
                  : ", no change"}
                ).
                {!quote.sameService ? " The original service is not offered for this address. This is the closest match." : ""}
              </p>
              <button
                type="button"
                className="btn btn-bronze"
                disabled={busy}
                onClick={() => buy({ shipmentId: quote.shipmentId, rateId: quote.rateId })}
              >
                {busy ? "Buying…" : `Buy label at ${formatUsd(quote.newCents)}`}
              </button>{" "}
              <button type="button" disabled={busy} onClick={() => setQuote(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-bronze" disabled={busy || !address} onClick={() => buy()}>
              {busy ? "Buying…" : "Buy label"}
            </button>
          )}
          {order.labelStatus === "error" && order.labelError && !note ? <p className="err">{plainError(order.labelError)}</p> : null}
        </>
      )}
      {note ? <p className={bad ? "err" : "ok"}>{note}</p> : null}
    </div>
  );
}
