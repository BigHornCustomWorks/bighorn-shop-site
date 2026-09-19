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
      <h1>Mill accessories &amp; fab goods</h1>
      <p className="lede">{store.site.shippingNote}</p>
      <Link className="gallery-cta signs-cta physical-signs-cta" href="/signs">
        <div className="gallery-cta-media">
          <img
            src={
              (store.metalSigns.media || []).find((src) => src && !/\.(mp4|webm|mov)(\?|$)/i.test(src)) ||
              "/gallery/gallery-cta-hero.jpg"
            }
            alt=""
          />
        </div>
        <div className="gallery-cta-panel">
          <span className="badge">Metal signs</span>
          <h2>{store.metalSigns.heading || "CNC plasma-cut signs"}</h2>
          <p>Ready-made signs and custom sizes live on their own page.</p>
          <span className="btn btn-spark">Shop metal signs →</span>
        </div>
      </Link>
      <ShopBrowser products={products} categories={categories} />
    </div>
  );
}
