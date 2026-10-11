import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogShelf } from "@/components/CatalogShelf";
import { PickupBanner } from "@/components/PickupBanner";
import { shelfEntries } from "@/lib/families";
import { readStore, signProductsInCategory } from "@/lib/store";

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
      <CatalogShelf entries={shelfEntries(group.products)} />
    </div>
  );
}
