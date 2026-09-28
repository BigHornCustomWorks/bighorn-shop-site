import type { Product, ShopOrder } from "./types";

export type HistoryProduct = Pick<Product, "id" | "name" | "slug" | "sku"> & { category?: string };

export type OrderSort = "newest" | "oldest" | "amount-desc" | "amount-asc" | "name-asc" | "name-desc";

export type OrderHistoryFilters = {
  from: string;
  to: string;
  allTime: boolean;
  /** Empty means any product. */
  productId: string;
  /** Category name from the catalog. Empty means any category. */
  category: string;
  itemQuery: string;
  fulfillment: "" | "ship" | "pickup" | "digital";
  smsOnly: boolean;
  reviewPending: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  sort: OrderSort;
};

const DENVER = "America/Denver";

export function denverToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DENVER,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function shiftDay(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function orderDay(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DENVER,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

export function orderWhen(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DENVER,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(t));
}

export function orderPhone(order: ShopOrder): string {
  return (order.phone || order.shipTo?.phone || "").trim();
}

export function orderFulfillment(order: ShopOrder): "ship" | "pickup" | "digital" | "" {
  if (order.fulfillment === "pickup" || order.fulfillment === "digital" || order.fulfillment === "ship") {
    return order.fulfillment;
  }
  if ((order.address || "").trim() || (order.shipTo?.street1 || "").trim()) return "ship";
  return "";
}

export function orderStatus(order: ShopOrder): string {
  if (order.shippedAt || order.trackingNumber) return "shipped";
  if (order.labelStatus === "bought") return "label bought";
  const how = orderFulfillment(order);
  if (order.paymentStatus === "paid") {
    if (how === "pickup") return "paid · pickup";
    if (how === "digital") return "paid · digital";
    return "paid";
  }
  return order.paymentStatus || "recorded";
}

export function smsOptInFromCustomFields(
  fields: { key?: string; type?: string; dropdown?: { value?: string | null } | null }[] | null | undefined,
): boolean {
  const field = (fields || []).find((f) => f.key === "sms_opt_in");
  return field?.type === "dropdown" && field.dropdown?.value === "yes";
}

export function fulfillmentFromCart(
  requested: string,
  slugs: string[],
  products: { slug: string; kind: string }[],
): "ship" | "pickup" | "digital" | "" {
  if (requested === "pickup") return "pickup";
  if (slugs.length) {
    const kinds = slugs.map((slug) => products.find((p) => p.slug === slug)?.kind);
    if (kinds.every((kind) => kind === "digital")) return "digital";
  }
  if (requested === "digital") return "digital";
  if (requested === "ship") return "ship";
  return "";
}

export function orderMatchesProduct(order: ShopOrder, product: HistoryProduct): boolean {
  const items = order.items.toLowerCase();
  const name = product.name.trim().toLowerCase();
  if (name && items.includes(name)) return true;
  const slug = product.slug.trim().toLowerCase();
  if (slug && items.includes(slug)) return true;
  const sku = (product.sku || "").trim().toLowerCase();
  if (sku && items.includes(`item ${sku}`)) return true;
  return false;
}

export function filterOrders(
  orders: ShopOrder[],
  products: HistoryProduct[],
  filters: OrderHistoryFilters,
): ShopOrder[] {
  const selected = filters.productId ? products.filter((p) => p.id === filters.productId) : [];
  const inCategory = filters.category
    ? products.filter((p) => (p.category || "").trim().toLowerCase() === filters.category.trim().toLowerCase())
    : [];
  const q = filters.itemQuery.trim().toLowerCase();
  const rows = orders.filter((order) => {
    if (!filters.allTime) {
      const day = orderDay(order.createdAt);
      if (filters.from && (!day || day < filters.from)) return false;
      if (filters.to && (!day || day > filters.to)) return false;
    }
    if (filters.category && !inCategory.some((p) => orderMatchesProduct(order, p))) return false;
    if (selected.length && !selected.some((p) => orderMatchesProduct(order, p))) return false;
    if (q && !order.items.toLowerCase().includes(q)) return false;
    if (filters.fulfillment && orderFulfillment(order) !== filters.fulfillment) return false;
    if (filters.smsOnly && order.smsOptIn !== true) return false;
    if (filters.reviewPending && (order.reviewRequestedAt || "").trim()) return false;
    if (filters.hasPhone && !orderPhone(order)) return false;
    if (filters.hasEmail && !order.email.trim()) return false;
    return true;
  });
  rows.sort((a, b) => {
    switch (filters.sort) {
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      case "amount-desc":
        return b.amountCents - a.amountCents || b.createdAt.localeCompare(a.createdAt);
      case "amount-asc":
        return a.amountCents - b.amountCents || b.createdAt.localeCompare(a.createdAt);
      case "name-asc":
        return (
          (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }) ||
          b.createdAt.localeCompare(a.createdAt)
        );
      case "name-desc":
        return (
          (b.name || "").localeCompare(a.name || "", undefined, { sensitivity: "base" }) ||
          b.createdAt.localeCompare(a.createdAt)
        );
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });
  return rows;
}

export function customerKey(order: ShopOrder): string {
  const email = order.email.trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = orderPhone(order).replace(/\D/g, "");
  if (phone) return `phone:${phone}`;
  return `order:${order.id}`;
}

export function ordersForCustomer(orders: ShopOrder[], order: ShopOrder): ShopOrder[] {
  const key = customerKey(order);
  return orders
    .filter((row) => customerKey(row) === key)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function ordersToCsv(orders: ShopOrder[]): string {
  const header = [
    "date",
    "order id",
    "name",
    "email",
    "phone",
    "smsOptIn",
    "amount",
    "items",
    "fulfillment",
    "shipped",
    "reviewRequestedAt",
    "repairReviewRequestedAt",
  ];
  const lines = orders.map((order) =>
    [
      orderWhen(order.createdAt),
      order.id,
      order.name,
      order.email,
      orderPhone(order),
      order.smsOptIn ? "yes" : "no",
      (order.amountCents / 100).toFixed(2),
      order.items.replace(/\s*\n\s*/g, " | "),
      orderFulfillment(order),
      order.shippedAt ? "yes" : "no",
      order.reviewRequestedAt || "",
      order.repairReviewRequestedAt || "",
    ]
      .map((cell) => csvCell(String(cell ?? "")))
      .join(","),
  );
  return `\uFEFF${header.join(",")}\n${lines.join("\n")}\n`;
}
