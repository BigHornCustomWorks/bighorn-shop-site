import Link from "next/link";
import { ShopBrowser } from "@/components/ShopBrowser";
import { readStore, shopFilterCategories, visibleProducts } from "@/lib/store";

export default async function PhysicalPage() {
  const store = await readStore();
  const products = visibleProducts(store).filter(
    (p) => p.kind !== "digital" && !/digital/i.test(p.category),
  );
  const categories = shopFilterCategories({ ...store, products });

  return (
    <div className="wrap">
      <p className="back-row">
        <Link className="back-link" href="/">
          ← Home
        </Link>
      </p>
      <p className="section-kicker">Physical products</p>
      <h1>Parts, signs &amp; fab goods</h1>
      <p className="lede">
        {store.site.shippingNote} Mill accessories ship from Sheridan. CNC plasma-cut signs and custom signs may appear
        as coming soon until SKUs are ready in Master Control.
      </p>
      <ShopBrowser products={products} categories={categories} />
      <div className="card" style={{ marginTop: 28 }}>
        <p className="section-kicker">Also coming into this door</p>
        <h3>CNC plasma-cut signs · Custom signs</h3>
        <p className="muted">
          Placeholder for signage lines — no invented prices. When ready, add them in Master Control under a physical
          category.
        </p>
        <Link className="btn" href="/custom">
          Request a custom sign quote
        </Link>
      </div>
    </div>
  );
}
