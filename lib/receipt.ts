/** Customer receipt. Amounts come only from the order. The card line comes from Stripe when we have it. */

export type ReceiptOrder = {
  id: string;
  createdAt: string;
  name: string;
  items: string;
  address: string;
  fulfillment: string;
  shippingLabel: string;
  shippingCents: number;
  taxCents: number;
  amountCents: number;
  paymentStatus: string;
  /** "Visa credit card ending 6009". Empty when Stripe did not return a method. */
  paymentMethod?: string;
  comment?: string;
};

export type ReceiptParts = {
  greeting: string;
  orderId: string;
  date: string;
  payment: string;
  items: string;
  money: { label: string; value: string }[];
  fulfillment: string;
  address: string;
  comment: string;
};

function usd(cents: number): string {
  const n = Number.isFinite(cents) ? Math.round(cents) : 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return sign + "$" + (abs / 100).toFixed(2);
}

function whenDenver(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso.trim();
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(t));
}

export function receiptComment(value: string): string {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, 800);
}

/** Older orders never stored Stripe's payment_status. Those rows came from a completed checkout. */
export function receiptPaymentLine(status: string, method = ""): string {
  const how = method.trim();
  if (how) return /^paid\b/i.test(how) ? how : `Paid with ${how}`;
  const s = status.trim().toLowerCase();
  if (s === "paid" || s === "") return "Paid by card through Stripe";
  if (s === "unpaid") return "Not marked paid";
  if (s === "no_payment_required") return "No payment was required";
  return status.trim();
}

export function receiptParts(order: ReceiptOrder): ReceiptParts {
  const goods = order.amountCents - order.shippingCents - order.taxCents;
  const money: { label: string; value: string }[] = [];
  if (goods >= 0 && (order.shippingCents > 0 || order.taxCents > 0)) {
    money.push({ label: "Subtotal", value: usd(goods) });
  }
  const shipName = order.shippingLabel.trim();
  money.push({
    label: "Shipping",
    value: `${shipName ? `${shipName} — ` : ""}${usd(order.shippingCents)}`,
  });
  if (order.taxCents > 0) money.push({ label: "Sales tax", value: usd(order.taxCents) });
  money.push({ label: "Total", value: usd(order.amountCents) });
  let fulfillment = "";
  if (order.fulfillment === "pickup") fulfillment = "Pickup in Sheridan, Wyoming.";
  else if (order.fulfillment === "digital") fulfillment = "Digital order. Nothing shipped.";
  const address = order.fulfillment === "digital" ? "" : order.address.trim();
  return {
    greeting: order.name.trim() ? `Hi ${order.name.trim()},` : "Hi,",
    orderId: order.id.trim() || "—",
    date: whenDenver(order.createdAt),
    payment: receiptPaymentLine(order.paymentStatus, order.paymentMethod || ""),
    items: order.items.trim() || "(none listed)",
    money,
    fulfillment,
    address,
    comment: receiptComment(order.comment || ""),
  };
}

export function receiptEmailText(order: ReceiptOrder): string {
  const parts = receiptParts(order);
  const lines = [
    parts.greeting,
    "",
    "This is your receipt from Big Horn Custom Works in Sheridan, Wyoming.",
    "",
    `Order: ${parts.orderId}`,
    `Date: ${parts.date}`,
    `Payment: ${parts.payment}`,
    "",
    "Items:",
    parts.items,
    "",
  ];
  if (parts.fulfillment) lines.push(parts.fulfillment);
  for (const row of parts.money) lines.push(`${row.label}: ${row.value}`);
  if (parts.comment) lines.push("", "Note:", parts.comment);
  if (parts.address) lines.push("", "Ship to:", parts.address);
  lines.push("", "Reply to this email if you need a copy of anything else.", "", "— Clint, Big Horn Custom Works");
  return lines.join("\n");
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function receiptEmailHtml(order: ReceiptOrder, logoUrl: string): string {
  const parts = receiptParts(order);
  const logo = logoUrl.trim().startsWith("https://")
    ? `<img src="${esc(logoUrl.trim())}" alt="Big Horn Custom Works" width="180" style="display:block;width:180px;height:auto;margin:0 auto 16px;" />`
    : "";
  const money = parts.money
    .map(
      (row) =>
        `<tr><td style="padding:4px 12px 4px 0;">${esc(row.label)}</td><td style="padding:4px 0;text-align:right;">${esc(row.value)}</td></tr>`,
    )
    .join("");
  const note = parts.comment
    ? `<p style="margin:16px 0 0;"><strong>Note:</strong><br />${esc(parts.comment).replace(/\n/g, "<br />")}</p>`
    : "";
  const ship = parts.address
    ? `<p style="margin:16px 0 0;"><strong>Ship to:</strong><br />${esc(parts.address).replace(/\n/g, "<br />")}</p>`
    : "";
  const how = parts.fulfillment ? `<p style="margin:12px 0;">${esc(parts.fulfillment)}</p>` : "";
  return `<div style="font-family:Georgia,serif;color:#1c1915;max-width:520px;margin:0 auto;">
${logo}
<p style="text-align:center;margin:0 0 16px;letter-spacing:0.04em;">Big Horn Custom Works<br />Sheridan, Wyoming</p>
<p>${esc(parts.greeting)}</p>
<p>This is your receipt from Big Horn Custom Works in Sheridan, Wyoming.</p>
<p>Order: ${esc(parts.orderId)}<br />Date: ${esc(parts.date)}<br />Payment: ${esc(parts.payment)}</p>
<p style="margin-bottom:4px;"><strong>Items</strong></p>
<p style="white-space:pre-wrap;margin-top:0;">${esc(parts.items)}</p>
${how}
<table style="border-collapse:collapse;width:100%;max-width:320px;">${money}</table>
${note}
${ship}
<p style="margin-top:20px;">Reply to this email if you need a copy of anything else.</p>
<p>— Clint, Big Horn Custom Works</p>
</div>`;
}
