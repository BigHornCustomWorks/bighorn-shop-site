import { ShopBrowser } from "@/components/ShopBrowser";
import { readStore, shopFilterCategories, visibleProducts } from "@/lib/store";

export default async function ShopPage() {
  const store = await readStore();
  const products = visibleProducts(store);
  const categories = shopFilterCategories(store);

  return (
    <div className="wrap">
      <p className="section-kicker">Shop</p>
      <h1>From the Sheridan shop</h1>
      <p className="lede">{store.site.shippingNote}</p>
      <ShopBrowser products={products} categories={categories} />
    </div>
  );
}
