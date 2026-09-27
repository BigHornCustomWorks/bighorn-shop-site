import type { Product, ProductVariant } from "./types";

export function stockText(onHand: number | null | undefined): string | null {
  if (onHand == null) return null;
  if (onHand <= 0) return "Made to order";
  if (onHand === 1) return "1 ready to ship";
  return `${onHand} ready to ship`;
}

export function variantStock(variant: ProductVariant | undefined): string | null {
  return stockText(variant?.onHand);
}

export function stockLabel(product: Product): string | null {
  const tracked = (product.variants || []).filter((v) => v.name.trim() && v.onHand != null);
  if (tracked.length) return "Stock is listed on each size / finish";
  return stockText(product.onHand);
}
