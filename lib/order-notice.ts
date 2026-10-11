export type OrderNotice = {
  email: string;
  name: string;
  phone?: string;
  amountLabel: string;
  items: string;
  address: string;
  sessionId: string;
  paid: boolean;
  shippingLabel?: string;
  shippingLabelCost?: string;
  taxLabel?: string;
  source?: string;
};

/** Short label for the shop inbox, from Checkout metadata.kind. */
export function orderSourceLabel(kind: string): string {
  if (kind === "payment-quote") return "Custom payment link";
  if (kind === "sign-estimate") return "Custom sign checkout";
  if (kind === "sign-design") return "Sign design";
  return "Shop checkout";
}

export function orderNoticeSubject(detail: Pick<OrderNotice, "amountLabel" | "name" | "email">): string {
  const who = detail.name.trim() || detail.email.trim() || "a customer";
  return `New order ${detail.amountLabel} — ${who}`;
}

export function orderNoticeText(detail: OrderNotice): string {
  const shipping = detail.shippingLabel
    ? `Shipping paid: ${detail.shippingLabel}${detail.shippingLabelCost ? ` — ${detail.shippingLabelCost}` : ""}`
    : "Shipping paid: none selected";
  return [
    detail.paid ? "New paid order — Big Horn Custom Works" : "New order — Big Horn Custom Works",
    "",
    `Customer: ${detail.name.trim() || "(no name)"}`,
    `Email: ${detail.email.trim() || "(none)"}`,
    `Phone: ${(detail.phone || "").trim() || "(none)"}`,
    `Total: ${detail.amountLabel}`,
    `Paid: ${detail.paid ? "yes (Stripe)" : "no"}`,
    `Came from: ${detail.source || "Shop checkout"}`,
    "",
    "What they ordered:",
    detail.items.trim() || "(none listed)",
    "",
    shipping,
    `Sales tax collected: ${detail.taxLabel || "$0.00"}`,
    "",
    detail.address.trim() ? `Ship to:\n${detail.address.trim()}` : "No shipping address on the order.",
    "",
    "Open Master Control. The new order is marked on the main page and listed under Inbox.",
    `Stripe session: ${detail.sessionId}`,
  ].join("\n");
}
