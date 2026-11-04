import type { MetadataRoute } from "next";
import { shelfEntries } from "@/lib/families";
import { isRepairStatusProduct } from "@/lib/repair-status";
import { SERVICE_PAGES, SITE_URL } from "@/lib/seo";
import { physicalCategoryDoors, readStore, signCategoryDoors, visibleProducts } from "@/lib/store";

// Rebuilt on each request so new products and categories from Master Control show up.
export const dynamic = "force-dynamic";

const STATIC_PATHS: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/services", priority: 0.9 },
  ...SERVICE_PAGES.map((s) => ({ path: `/services/${s.slug}`, priority: 0.9 })),
  { path: "/signs", priority: 0.8 },
  { path: "/physical", priority: 0.8 },
  { path: "/shop", priority: 0.7 },
  { path: "/digital", priority: 0.6 },
  { path: "/gallery", priority: 0.6 },
  { path: "/about", priority: 0.6 },
  { path: "/contact", priority: 0.6 },
  { path: "/privacy", priority: 0.2 },
  { path: "/terms", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    priority,
  }));

  // Catalog pages come from the store. If it can't be read, still serve the static list.
  try {
    const store = await readStore();
    const seen = new Set(entries.map((e) => e.url));
    const add = (path: string, priority: number) => {
      const url = `${SITE_URL}${path}`;
      if (seen.has(url)) return;
      seen.add(url);
      entries.push({ url, lastModified: now, priority });
    };
    for (const d of signCategoryDoors(store)) add(`/signs/${d.slug}`, 0.7);
    for (const d of physicalCategoryDoors(store)) add(`/physical/${d.slug}`, 0.7);
    const products = visibleProducts(store);
    for (const p of products) {
      if (isRepairStatusProduct(p) || !p.slug) continue;
      add(`/shop/${p.slug}`, 0.6);
    }
    for (const entry of shelfEntries(products)) {
      if (entry.kind === "family") add(`/shop/family/${encodeURIComponent(entry.stem)}`, 0.5);
    }
  } catch {
    /* static entries only */
  }
  return entries;
}
