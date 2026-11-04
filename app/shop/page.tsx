import { ShopBrowser } from "@/components/ShopBrowser";
import { readStore, shopFilterCategories, visibleProducts } from "@/lib/store";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Shop All Products, Sheridan, WY | Big Horn Custom Works",
  description:
    "Shop mill accessories, plasma-cut metal signs, 3D-printed parts and digital files made by Big Horn Custom Works in Sheridan, WY. Secure Stripe checkout.",
  path: "/shop",
});

export default async function ShopPage() {
  const store = await readStore();
  const products = visibleProducts(store);
  const categories = shopFilterCategories(store);

  return (
    <div className="wrap">
      <p className="section-kicker">Shop</p>
      <h1>Parts, signs &amp; files from the Sheridan shop</h1>
      <p className="lede">{store.site.shippingNote}</p>
      <ShopBrowser products={products} categories={categories} />
    </div>
  );
}
