import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { physicalProductsInCategory, readStore } from "@/lib/store";

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
      <div className="grid-catalog">
        {group.products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
