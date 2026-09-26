import type { Product } from "./types";
import { skuStem } from "./sku";

export type ShelfEntry =
  | { kind: "one"; product: Product }
  | { kind: "family"; stem: string; members: Product[] };

function familyCode(sku: string): string | null {
  const text = sku.trim();
  if (!/^\d+[a-z]?$/i.test(text)) return null;
  return skuStem(text);
}

export function familyLead(members: Product[]): Product {
  const base = members.find((p) => p.sku.trim().toLowerCase() === skuStem(p.sku).toLowerCase());
  return base || members[0];
}

export function shelfEntries(products: Product[]): ShelfEntry[] {
  const buckets = new Map<string, Product[]>();
  for (const product of products) {
    const code = familyCode(product.sku);
    if (!code) continue;
    const list = buckets.get(code) || [];
    list.push(product);
    buckets.set(code, list);
  }
  const seen = new Set<string>();
  const entries: ShelfEntry[] = [];
  for (const product of products) {
    const code = familyCode(product.sku);
    if (!code) {
      entries.push({ kind: "one", product });
      continue;
    }
    if (seen.has(code)) continue;
    seen.add(code);
    const members = buckets.get(code) || [product];
    if (members.length < 2) entries.push({ kind: "one", product: members[0] });
    else entries.push({ kind: "family", stem: code, members });
  }
  return entries;
}

export function productsInFamily(products: Product[], stem: string): Product[] {
  const want = stem.trim().toLowerCase();
  return products.filter((p) => familyCode(p.sku)?.toLowerCase() === want);
}
