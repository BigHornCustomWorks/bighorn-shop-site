"use client";

import { useMemo, useState } from "react";
import { ReceiptComposer } from "@/components/ReceiptComposer";
import { digitalSlugsForOrder, downloadStatusLabel } from "@/lib/digital-delivery";
import { formatUsd } from "@/lib/money";
import {
  denverToday,
  filterOrders,
  isArchived,
  orderFulfillment,
  orderPhone,
  orderStatus,
  orderWhen,
  ordersForCustomer,
  ordersToCsv,
  paymentHaystack,
  quoteHaystack,
  shiftDay,
  visibleMessages,
  type OrderSort,
} from "@/lib/order-history";
import { quotePayable } from "@/lib/payment-quote-view";
import type { PaymentQuote, ShopOrder, ShopStore } from "@/lib/types";

type ArchiveKind = "order" | "quote" | "payment";

const today = denverToday();

export function OrderHistoryTab({
  store,
  onOrderUpdated,
  onArchive,
  onOpen,
}: {
  store: ShopStore;
  onOrderUpdated: (orderId: string, fields: Partial<ShopOrder>) => void;
  onArchive: (kind: ArchiveKind, id: string, archived: boolean) => Promise<boolean>;
  onOpen: (kind: ArchiveKind, id: string) => void;
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

  const quoteMessages = useMemo(
    () => visibleMessages(store.quotes || [], itemQuery, quoteHaystack),
    [store.quotes, itemQuery],
  );
  const paymentMessages = useMemo(
    () => visibleMessages(store.paymentQuotes || [], itemQuery, paymentHaystack),
    [store.paymentQuotes, itemQuery],
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
      <p className="note">
        Search finds a name, email, phone, order number, or what they ordered. The dates above still apply — check All
        time for older orders. Archived orders stay in this list. Open in inbox puts one back on the Inbox tab so you
        can buy a label or mark it shipped. Times are Sheridan time.
      </p>

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
          Search
          <input
            value={itemQuery}
            placeholder="Name, email, phone, order, or item"
            onChange={(e) => setItemQuery(e.target.value)}
          />
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
          <input type="checkbox" checked={reviewPending} onChange={(e) => setReviewPending(e.target.checked)} /> Big Horn
          review not sent
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
          products={store.products}
          open={openId === order.id}
          onToggle={() => setOpenId(openId === order.id ? null : order.id)}
          onViewCustomer={() => {
            setCustomerId(order.id);
            setOpenId(order.id);
          }}
          onReviewed={(fields) => onOrderUpdated(order.id, fields)}
          onArchive={onArchive}
          onOpen={onOpen}
        />
      ))}

      <h2>Messages</h2>
      <p className="note">
        {itemQuery.trim()
          ? "Quote requests and payment links matching that search, including ones still in the inbox."
          : "Archived quote requests and payment links. Type a search to find one that is still in the inbox too."}
      </p>
      {!quoteMessages.length && !paymentMessages.length ? <p>No messages in this view.</p> : null}
      {quoteMessages.map((quote) => (
        <HistoryMessage
          key={quote.id}
          kind="quote"
          id={quote.id}
          archived={isArchived(quote)}
          title={quote.name || "Quote request"}
          meta={`${quote.email || "no email"}${quote.phone ? ` · ${quote.phone}` : ""} · ${orderWhen(quote.createdAt)}`}
          body={quote.need}
          onArchive={onArchive}
          onOpen={onOpen}
        />
      ))}
      {paymentMessages.map((quote) => (
        <HistoryMessage
          key={quote.id}
          kind="payment"
          id={quote.id}
          archived={isArchived(quote)}
          title={`${quote.title} · ${formatUsd(quote.amountCents)}`}
          meta={`${quote.name || "No name"} · ${quote.email} · ${orderWhen(quote.createdAt)} · ${paymentState(quote)}`}
          body={quote.detail}
          onArchive={onArchive}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function paymentState(quote: PaymentQuote): string {
  const state = quotePayable(quote.status, quote.createdAt);
  if (state === "paid") return "Paid";
  if (state === "void") return "Canceled";
  if (state === "expired") return "Expired";
  return "Waiting for payment";
}

function HistoryRow({
  order,
  products,
  open,
  onToggle,
  onViewCustomer,
  onReviewed,
  onArchive,
  onOpen,
}: {
  order: ShopOrder;
  products: { slug: string; name: string; kind: string }[];
  open: boolean;
  onToggle: () => void;
  onViewCustomer: () => void;
  onReviewed: (fields: Partial<ShopOrder>) => void;
  onArchive: (kind: ArchiveKind, id: string, archived: boolean) => Promise<boolean>;
  onOpen: (kind: ArchiveKind, id: string) => void;
}) {
  const [busy, setBusy] = useState<"shop" | "repair" | "download" | "archive" | "">("");
  const [note, setNote] = useState("");
  const [bad, setBad] = useState(false);
  const phone = orderPhone(order);
  const how = orderFulfillment(order) || "—";
  const matchedSlugs = (order.digitalSlugs || []).length ? order.digitalSlugs || [] : digitalSlugsForOrder(order, products);
  const downloadLabel = downloadStatusLabel({
    ...order,
    digitalSlugs: matchedSlugs,
  });

  async function resendDownload() {
    setBusy("download");
    setNote("");
    setBad(false);
    try {
      const res = await fetch("/api/master/digital-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setBad(true);
        setNote(json.error || "The download email was not sent.");
        if (json.digitalEmailed) onReviewed({ digitalEmailed: true, digitalEmailError: "" });
        return;
      }
      onReviewed({ digitalEmailed: true, digitalEmailError: "" });
      setNote("Download links emailed to the buyer.");
    } catch (err) {
      setBad(true);
      setNote(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setBusy("");
    }
  }

  async function sendReview(brand: "shop" | "repair", again = false) {
    setBusy(brand);
    setNote("");
    setBad(false);
    const label = brand === "repair" ? "Repair Status" : "Big Horn";
    try {
      const res = await fetch("/api/master/review-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, brand, again }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && json.already) {
        const againOk = window.confirm(json.error || `Send the ${label} review request again?`);
        if (againOk) return sendReview(brand, true);
        setBad(true);
        setNote(json.error || "Already sent.");
        return;
      }
      const sentAt = json.reviewRequestedAt || new Date().toISOString();
      if (!res.ok) {
        setBad(true);
        setNote(json.error || "The review email was not sent.");
        if (json.reviewRequestedAt) {
          onReviewed(brand === "repair" ? { repairReviewRequestedAt: sentAt } : { reviewRequestedAt: sentAt });
        }
        return;
      }
      onReviewed(brand === "repair" ? { repairReviewRequestedAt: sentAt } : { reviewRequestedAt: sentAt });
      setNote(`${label} review request sent.`);
    } catch (err) {
      setBad(true);
      setNote(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setBusy("");
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
        {downloadLabel ? (
          <span className={order.digitalEmailed ? "mc-flag ok" : order.digitalEmailError && order.digitalEmailError !== "sending" ? "mc-flag err" : "mc-flag"}>
            {downloadLabel}
          </span>
        ) : null}
      </p>
      <p className="muted">
        Order {order.id}
        {isArchived(order) ? " · archived" : ""}
        {order.receiptEmailedAt ? ` · receipt emailed ${orderWhen(order.receiptEmailedAt)}` : " · no shop receipt emailed yet"}
      </p>
      <p style={{ whiteSpace: "pre-wrap" }}>{order.items}</p>
      <p className={order.reviewRequestedAt ? "note" : "muted"}>
        {order.reviewRequestedAt
          ? `Big Horn review requested ${orderWhen(order.reviewRequestedAt)}`
          : "Big Horn review not requested"}
      </p>
      <p className={order.repairReviewRequestedAt ? "note" : "muted"}>
        {order.repairReviewRequestedAt
          ? `Repair Status review requested ${orderWhen(order.repairReviewRequestedAt)}`
          : "Repair Status review not requested"}
      </p>
      <div className="hero-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={Boolean(busy)}
          onClick={async () => {
            setBusy("archive");
            setNote("");
            setBad(false);
            const ok = await onArchive("order", order.id, !isArchived(order));
            if (!ok) {
              setBad(true);
              setNote("Could not update that.");
            }
            setBusy("");
          }}
        >
          {busy === "archive" ? "Saving…" : isArchived(order) ? "Put back in inbox" : "Archive"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => onOpen("order", order.id)} disabled={Boolean(busy)}>
          Open in inbox
        </button>
        <button type="button" className="btn" onClick={() => sendReview("shop")} disabled={Boolean(busy) || !order.email}>
          {busy === "shop" ? "Sending…" : order.reviewRequestedAt ? "Send Big Horn review again" : "Send Big Horn review"}
        </button>
        <button type="button" className="btn" onClick={() => sendReview("repair")} disabled={Boolean(busy) || !order.email}>
          {busy === "repair"
            ? "Sending…"
            : order.repairReviewRequestedAt
              ? "Send Repair Status review again"
              : "Send Repair Status review"}
        </button>
        <button type="button" className="btn-ghost" onClick={onViewCustomer}>
          View customer
        </button>
        {downloadLabel ? (
          <button type="button" className="btn" onClick={resendDownload} disabled={Boolean(busy) || !order.email}>
            {busy === "download" ? "Sending…" : order.digitalEmailed ? "Resend download links" : "Email download links"}
          </button>
        ) : null}
      </div>
      <ReceiptComposer
        orderId={order.id}
        email={order.email}
        receiptEmailedAt={order.receiptEmailedAt}
        onSent={(sentAt) => onReviewed({ receiptEmailedAt: sentAt })}
      />
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

function HistoryMessage({
  kind,
  id,
  archived,
  title,
  meta,
  body,
  onArchive,
  onOpen,
}: {
  kind: ArchiveKind;
  id: string;
  archived: boolean;
  title: string;
  meta: string;
  body: string;
  onArchive: (kind: ArchiveKind, id: string, archived: boolean) => Promise<boolean>;
  onOpen: (kind: ArchiveKind, id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="quote-item">
      <strong>{title}</strong>
      {archived ? <span className="muted"> · archived</span> : null}
      <p>{meta}</p>
      {body ? <p style={{ whiteSpace: "pre-wrap" }}>{body}</p> : null}
      <div className="hero-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setNote("");
            const ok = await onArchive(kind, id, !archived);
            if (!ok) setNote("Could not update that.");
            setBusy(false);
          }}
        >
          {busy ? "Saving…" : archived ? "Put back in inbox" : "Archive"}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => onOpen(kind, id)}>
          Open in inbox
        </button>
      </div>
      {note ? <p className="err">{note}</p> : null}
    </div>
  );
}
