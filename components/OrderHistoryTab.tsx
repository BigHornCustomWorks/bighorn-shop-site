"use client";

import { useMemo, useState } from "react";
import { formatUsd } from "@/lib/money";
import {
  denverToday,
  filterOrders,
  orderFulfillment,
  orderPhone,
  orderStatus,
  orderWhen,
  ordersForCustomer,
  ordersToCsv,
  shiftDay,
  type OrderSort,
} from "@/lib/order-history";
import type { ShopOrder, ShopStore } from "@/lib/types";

const today = denverToday();

export function OrderHistoryTab({
  store,
  onOrderUpdated,
}: {
  store: ShopStore;
  onOrderUpdated: (orderId: string, fields: Partial<ShopOrder>) => void;
}) {
  const [from, setFrom] = useState(shiftDay(today, -90));
  const [to, setTo] = useState(today);
  const [allTime, setAllTime] = useState(false);
  const [productId, setProductId] = useState("");
  const [category, setCategory] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [fulfillment, setFulfillment] = useState<"" | "ship" | "pickup" | "digital">("");
  const [smsOnly, setSmsOnly] = useState(false);
  const [reviewPending, setReviewPending] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [sort, setSort] = useState<OrderSort>("newest");
  const [openId, setOpenId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  const products = store.products || [];
  const orders = store.orders || [];

  const filtered = useMemo(
    () =>
      filterOrders(orders, products, {
        from,
        to,
        allTime,
        productId,
        category,
        itemQuery,
        fulfillment,
        smsOnly,
        reviewPending,
        hasPhone,
        hasEmail,
        sort,
      }),
    [orders, products, from, to, allTime, productId, category, itemQuery, fulfillment, smsOnly, reviewPending, hasPhone, hasEmail, sort],
  );

  const customerSource = orders.find((order) => order.id === customerId) || null;
  const customerOrders = customerSource ? ordersForCustomer(orders, customerSource) : [];
  const shown = customerSource ? customerOrders : filtered;
  const spent = customerOrders.reduce((sum, order) => sum + (order.amountCents || 0), 0);
  const latest = customerOrders[0];

  const categories = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    const add = (name: string) => {
      const trimmed = name.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) return;
      seen.add(key);
      names.push(trimmed);
    };
    [...(store.categories || [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((cat) => add(cat.name));
    products.forEach((product) => add(product.category || ""));
    return names;
  }, [store.categories, products]);

  const productOptions = useMemo(() => {
    return [...products]
      .filter((product) => !category || (product.category || "").trim().toLowerCase() === category.trim().toLowerCase())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, category]);

  function download() {
    const csv = ordersToCsv(shown);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = customerSource ? "customer-orders.csv" : "order-history.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h2>Order history</h2>
      <p className="note">Filters work together. Times are Sheridan time.</p>

      <div className="oh-bar">
        <label>
          From
          <input type="date" value={from} disabled={allTime} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} disabled={allTime} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="oh-check">
          <input type="checkbox" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} /> All time
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value;
              setCategory(next);
              const chosen = products.find((product) => product.id === productId);
              if (chosen && next && (chosen.category || "").trim().toLowerCase() !== next.trim().toLowerCase()) {
                setProductId("");
              }
            }}
          >
            <option value="">All categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          What they ordered
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Anything</option>
            {productOptions.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku ? `${product.sku} — ` : ""}
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Item name contains
          <input value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} />
        </label>
        <label>
          Fulfillment
          <select
            value={fulfillment}
            onChange={(e) =>
              setFulfillment(
                e.target.value === "ship" || e.target.value === "pickup" || e.target.value === "digital"
                  ? e.target.value
                  : "",
              )
            }
          >
            <option value="">Any</option>
            <option value="ship">Ship</option>
            <option value="pickup">Pickup</option>
            <option value="digital">Digital</option>
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as OrderSort)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount-desc">Amount, high to low</option>
            <option value="amount-asc">Amount, low to high</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </select>
        </label>
        <label className="oh-check">
          <input type="checkbox" checked={smsOnly} onChange={(e) => setSmsOnly(e.target.checked)} /> SMS OK
        </label>
        <label className="oh-check">
          <input type="checkbox" checked={reviewPending} onChange={(e) => setReviewPending(e.target.checked)} /> Review
          not sent
        </label>
        <label className="oh-check">
          <input type="checkbox" checked={hasPhone} onChange={(e) => setHasPhone(e.target.checked)} /> Has phone
        </label>
        <label className="oh-check">
          <input type="checkbox" checked={hasEmail} onChange={(e) => setHasEmail(e.target.checked)} /> Has email
        </label>
        <button className="btn" type="button" onClick={download} disabled={!shown.length}>
          Download CSV
        </button>
        <span className="muted" style={{ paddingBottom: 8 }}>
          {shown.length} order{shown.length === 1 ? "" : "s"}
        </span>
      </div>

      {customerSource && latest ? (
        <div className="quote-item">
          <p className="section-kicker">Customer</p>
          <h3>{latest.name || "Customer"}</h3>
          <p>
            {latest.email || "no email"}
            {orderPhone(latest) ? ` · ${orderPhone(latest)}` : ""}
            {latest.smsOptIn ? " · SMS OK" : ""}
          </p>
          <p>
            {customerOrders.length} order{customerOrders.length === 1 ? "" : "s"} · {formatUsd(spent)} total
          </p>
          <button type="button" className="btn-ghost" onClick={() => setCustomerId(null)}>
            Back to filtered orders
          </button>
        </div>
      ) : null}

      {!shown.length ? <p>No orders match this view.</p> : null}
      {shown.map((order) => (
        <HistoryRow
          key={order.id}
          order={order}
          open={openId === order.id}
          onToggle={() => setOpenId(openId === order.id ? null : order.id)}
          onViewCustomer={() => {
            setCustomerId(order.id);
            setOpenId(order.id);
          }}
          onReviewed={(reviewRequestedAt) => onOrderUpdated(order.id, { reviewRequestedAt })}
        />
      ))}
    </div>
  );
}

function HistoryRow({
  order,
  open,
  onToggle,
  onViewCustomer,
  onReviewed,
}: {
  order: ShopOrder;
  open: boolean;
  onToggle: () => void;
  onViewCustomer: () => void;
  onReviewed: (reviewRequestedAt: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [bad, setBad] = useState(false);
  const phone = orderPhone(order);
  const how = orderFulfillment(order) || "—";

  async function sendReview(again = false) {
    setBusy(true);
    setNote("");
    setBad(false);
    try {
      const res = await fetch("/api/master/review-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, again }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && json.already) {
        const againOk = window.confirm(json.error || "Send the review request again?");
        if (againOk) return sendReview(true);
        setBad(true);
        setNote(json.error || "Already sent.");
        return;
      }
      if (!res.ok) {
        setBad(true);
        setNote(json.error || "The review email was not sent.");
        if (json.reviewRequestedAt) onReviewed(json.reviewRequestedAt);
        return;
      }
      onReviewed(json.reviewRequestedAt || new Date().toISOString());
      setNote("Review request sent.");
    } catch (err) {
      setBad(true);
      setNote(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="quote-item">
      <button type="button" className="btn-ghost" onClick={onToggle}>
        {open ? "Hide" : "Details"}
      </button>{" "}
      <strong>{orderWhen(order.createdAt)}</strong> · {formatUsd(order.amountCents)} · {orderStatus(order)}
      <p>
        {order.name || "Customer"} · {order.email || "no email"}
        {phone ? ` · ${phone}` : " · no phone"}
        {order.smsOptIn ? " · SMS OK" : ""}
        {" · "}
        {how}
      </p>
      <p className="muted">Order {order.id}</p>
      <p style={{ whiteSpace: "pre-wrap" }}>{order.items}</p>
      {order.reviewRequestedAt ? (
        <p className="note">Review requested {orderWhen(order.reviewRequestedAt)}</p>
      ) : (
        <p className="muted">Review not requested</p>
      )}
      <div className="hero-actions">
        <button type="button" className="btn" onClick={() => sendReview(false)} disabled={busy || !order.email}>
          {busy ? "Sending…" : order.reviewRequestedAt ? "Send review request again" : "Send review request"}
        </button>
        <button type="button" className="btn-ghost" onClick={onViewCustomer}>
          View customer
        </button>
      </div>
      {note ? <p className={bad ? "err" : "ok"}>{note}</p> : null}
      {open ? (
        <div>
          <p style={{ whiteSpace: "pre-wrap" }}>{order.address || "No shipping address"}</p>
          {order.shipTo?.email || order.shipTo?.phone ? (
            <p className="muted">
              Address contact: {order.shipTo.email || "no email"}
              {order.shipTo.phone ? ` · ${order.shipTo.phone}` : ""}
            </p>
          ) : null}
          {order.shippingLabel ? <p className="muted">Shipping: {order.shippingLabel}</p> : null}
          {order.trackingNumber ? (
            <p>
              Tracking: {order.trackingCarrier || "carrier"} {order.trackingNumber}
              {order.labelTrackingUrl ? (
                <>
                  {" "}
                  <a href={order.labelTrackingUrl}>Track</a>
                </>
              ) : null}
            </p>
          ) : (
            <p className="muted">No tracking yet</p>
          )}
          {order.labelError ? <p className="err">{order.labelError}</p> : null}
          <p className="muted">Stripe session {order.sessionId || "—"}</p>
        </div>
      ) : null}
    </div>
  );
}
