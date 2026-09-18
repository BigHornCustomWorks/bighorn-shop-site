import Link from "next/link";
import { ShopBrowser } from "@/components/ShopBrowser";
import { readStore, shopFilterCategories, visibleProducts } from "@/lib/store";

export default async function PhysicalPage() {
  const store = await readStore();
  const products = visibleProducts(store).filter((p) => p.kind === "physical");
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
        {store.site.shippingNote} Mill accessories ship from Sheridan. Metal signs have their own size-based estimate.
      </p>
      <ShopBrowser products={products} categories={categories} />
      <div className="card" style={{ marginTop: 28 }}>
        <p className="section-kicker">Metal signs</p>
        <h3>{store.metalSigns.heading || "CNC plasma-cut signs"}</h3>
        <p className="muted">
          Enter a finished size, see the shop rate, and pay that amount on Stripe — or send a custom quote.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-bronze" href="/signs">
            Size estimator →
          </Link>
          <Link className="btn" href="/custom">
            Request a custom sign quote
          </Link>
        </div>
      </div>
    </div>
  );
}
