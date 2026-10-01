/** Customer receipt. Uses only amounts already stored on the order. */

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

/** Older orders never stored Stripe's payment_status. Those rows came from a completed checkout. */
export function receiptPaymentLine(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "paid" || s === "") return "Paid";
  if (s === "unpaid") return "Not marked paid";
  if (s === "no_payment_required") return "No payment was required";
  return status.trim();
}

export function receiptEmailText(order: ReceiptOrder): string {
  const name = order.name.trim();
  const items = order.items.trim();
  const address = order.address.trim();
  const goods = order.amountCents - order.shippingCents - order.taxCents;
  const lines = [
    name ? `Hi ${name},` : "Hi,",
    "",
    "This is your receipt from Big Horn Custom Works in Sheridan, Wyoming.",
    "",
    `Order: ${order.id.trim() || "—"}`,
    `Date: ${whenDenver(order.createdAt)}`,
    `Payment: ${receiptPaymentLine(order.paymentStatus)}`,
    "",
    "Items:",
    items || "(none listed)",
    "",
  ];
  if (goods >= 0 && (order.shippingCents > 0 || order.taxCents > 0)) {
    lines.push(`Subtotal: ${usd(goods)}`);
  }
  if (order.fulfillment === "pickup") {
    lines.push("Pickup in Sheridan, Wyoming.");
  } else if (order.fulfillment === "digital") {
    lines.push("Digital order. Nothing shipped.");
  }
  const shipName = order.shippingLabel.trim();
  lines.push(`Shipping: ${shipName ? `${shipName} — ` : ""}${usd(order.shippingCents)}`);
  if (order.taxCents > 0) lines.push(`Sales tax: ${usd(order.taxCents)}`);
  lines.push(`Total: ${usd(order.amountCents)}`);
  if (address && order.fulfillment !== "digital") {
    lines.push("", "Ship to:", address);
  }
  lines.push(
    "",
    "Reply to this email if you need a copy of anything else.",
    "",
    "— Clint, Big Horn Custom Works",
  );
  return lines.join("\n");
}
