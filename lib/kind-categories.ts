/** Categories that belong on one Master tab: used by that kind, or not used yet. */
export function categoriesForKind<T extends { name: string }>(
  categories: T[],
  products: { kind: string; category: string }[],
  kind: string,
): T[] {
  const kindsByName = new Map<string, Set<string>>();
  for (const product of products) {
    const key = (product.category || "").trim().toLowerCase();
    if (!key) continue;
    const kinds = kindsByName.get(key) || new Set<string>();
    kinds.add(product.kind);
    kindsByName.set(key, kinds);
  }
  return categories.filter((category) => {
    const kinds = kindsByName.get(category.name.trim().toLowerCase());
    if (!kinds || kinds.size === 0) return true;
    return kinds.has(kind);
  });
}
