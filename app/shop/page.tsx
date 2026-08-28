import { ProductCard } from "@/components/ProductCard";
import { readStore, visibleProducts } from "@/lib/store";

export default async function ShopPage() {
  const store = await readStore();
  const products = visibleProducts(store);

  return (
    <div className="wrap">
      <p className="section-kicker">Shop</p>
      <h1>Parts from the Sheridan shop</h1>
      <p className="lede">{store.site.shippingNote}</p>
      {products.length ? (
        <div className="grid-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p>Nothing on the shelf right now. Ask for a custom quote.</p>
      )}
    </div>
  );
}
