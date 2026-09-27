import type { Product, ProductVariant } from "./types";

export function listedVariants(product: Product): ProductVariant[] {
  return (product.variants || []).filter((v) => v.name.trim());
}

export function findVariant(product: Product, variant: string): ProductVariant | undefined {
  const want = variant.trim().toLowerCase();
  if (!want) return undefined;
  return listedVariants(product).find(
    (v) => v.name.toLowerCase() === want || v.id.toLowerCase() === want,
  );
}

export function variantUnitPrice(product: Product, variantName = ""): number {
  const v = findVariant(product, variantName);
  if (v && v.priceCents > 0) return v.priceCents;
  return product.priceCents;
}

export function lowestVariantPrice(product: Product): number {
  const prices = listedVariants(product).map((v) => (v.priceCents > 0 ? v.priceCents : product.priceCents));
  if (!prices.length) return product.priceCents;
  return Math.min(...prices);
}

export function variantPriceSpread(product: Product): boolean {
  const prices = listedVariants(product).map((v) => (v.priceCents > 0 ? v.priceCents : product.priceCents));
  return prices.length > 1 && Math.max(...prices) !== Math.min(...prices);
}
