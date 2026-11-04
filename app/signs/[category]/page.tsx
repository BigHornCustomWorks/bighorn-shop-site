import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogShelf } from "@/components/CatalogShelf";
import { PickupBanner } from "@/components/PickupBanner";
import { shelfEntries } from "@/lib/families";
import { pageMeta, withBrand } from "@/lib/seo";
import { readStore, signProductsInCategory } from "@/lib/store";
import { firstPhoto } from "@/lib/video";

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const path = `/signs/${category}`;
  try {
    const store = await readStore();
    const group = signProductsInCategory(store, category);
    if (group) {
      const label = /sign/i.test(group.name) ? group.name : `${group.name} Metal Signs`;
      const photo = group.products.map((p) => firstPhoto(p)).find(Boolean);
      return pageMeta({
        title: withBrand(`${label}, Sheridan, WY`),
        description: `${label} from Big Horn Custom Works — CNC plasma-cut to order in Sheridan, WY in the size and finish listed. Ship it or pick it up at the shop.`,
        path,
        image: photo || undefined,
        imageAlt: label,
      });
    }
  } catch {
    /* fall through */
  }
  return pageMeta({
    title: "Metal Signs, Sheridan, WY | Big Horn Custom Works",
    description: "Custom CNC plasma-cut metal signs from Big Horn Custom Works in Sheridan, WY.",
    path,
  });
}

export default async function SignCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const store = await readStore();
  const group = signProductsInCategory(store, category);
  if (!group) notFound();
  const pickupOn = store.site.pickupEnabled !== false;

  return (
    <div className="wrap">
      <p className="back-row">
        <Link className="back-link" href="/">
          ← Home
        </Link>
        <Link className="back-link" href="/signs">
          Signs
        </Link>
      </p>
      <p className="section-kicker">Custom metal signs</p>
      <h1>{group.name}</h1>
      <p className="lede">
        {group.products.length} {group.products.length === 1 ? "sign" : "signs"}. Cut when you order, in the size and
        finish listed.
      </p>
      <PickupBanner enabled={pickupOn} label={store.site.pickupLabel} />
      <p>
        <Link className="btn btn-ghost" href="/signs#shipping-calculator">
          Estimate shipping for a sign →
        </Link>
      </p>
      <CatalogShelf entries={shelfEntries(group.products)} />
    </div>
  );
}
