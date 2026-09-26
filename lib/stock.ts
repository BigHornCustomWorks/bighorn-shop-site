import type { Product } from "./types";

export function stockLabel(product: Product): string | null {
  if (product.onHand == null) return null;
  if (product.onHand <= 0) return "Made to order";
  if (product.onHand === 1) return "1 ready to ship";
  return `${product.onHand} ready to ship`;
}
