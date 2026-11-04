import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogShelf } from "@/components/CatalogShelf";
import { shelfEntries } from "@/lib/families";
import { pageMeta, withBrand } from "@/lib/seo";
import { physicalProductsInCategory, readStore } from "@/lib/store";
import { firstPhoto } from "@/lib/video";

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const path = `/physical/${category}`;
  try {
    const store = await readStore();
    const group = physicalProductsInCategory(store, category);
    if (group) {
      const photo = group.products.map((p) => firstPhoto(p)).find(Boolean);
      return pageMeta({
        title: withBrand(`${group.name}, Sheridan, WY`),
        description: `Shop ${group.name.toLowerCase()} made by Big Horn Custom Works in Sheridan, WY. ${group.products.length} ${group.products.length === 1 ? "item" : "items"} in this line, with shipping or local pickup.`,
        path,
        image: photo || undefined,
        imageAlt: group.name,
      });
    }
  } catch {
    /* fall through */
  }
  return pageMeta({
    title: "Physical Products, Sheridan, WY | Big Horn Custom Works",
    description: "Parts and fab goods from Big Horn Custom Works in Sheridan, WY.",
    path,
  });
}

export default async function PhysicalCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const store = await readStore();
  const group = physicalProductsInCategory(store, category);
  if (!group) notFound();

  return (
    <div className="wrap">
      <p className="back-row">
        <Link className="back-link" href="/">
          ← Home
        </Link>
        <Link className="back-link" href="/physical">
          Physical
        </Link>
      </p>
      <p className="section-kicker">Physical products</p>
      <h1>{group.name}</h1>
      <p className="lede">
        {group.products.length} {group.products.length === 1 ? "item" : "items"} in this line. {store.site.shippingNote}
      </p>
      <CatalogShelf entries={shelfEntries(group.products)} />
    </div>
  );
}
