import { asInt, cleanStr } from "./sanitize";
import type { Product, ShopStore } from "./types";

export type CartItem = { product: Product; quantity: number; variant: string };

/**
 * Turns the browser's cart rows into real catalog items. Prices, weights and
 * visibility always come from the store, never from the request. Shared by
 * checkout and the live-rate lookup so both see the same cart.
 */
export function resolveCartItems(store: ShopStore, rows: unknown): CartItem[] {
  const itemsIn = Array.isArray(rows) ? rows : [];
  return itemsIn
    .map((row: { productId?: string; quantity?: number; variant?: string }) => {
      const product = store.products.find((p) => p.id === cleanStr(row?.productId) && p.visible);
      if (!product) return null;
      // Link-out / coming-soon digital services are not Stripe cart items.
      if (product.externalUrl || /coming soon/i.test(product.priceLabel || "")) return null;
      return {
        product,
        quantity: asInt(row.quantity, 1),
        variant: cleanStr(row.variant),
      };
    })
    .filter(Boolean) as CartItem[];
}
