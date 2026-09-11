import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { readStore, visibleProducts } from "@/lib/store";

export default async function DigitalPage() {
  const store = await readStore();
  const products = visibleProducts(store).filter(
    (p) => p.kind === "digital" || /digital/i.test(p.category),
  );

  return (
    <div className="wrap">
      <p className="back-row">
        <Link className="back-link" href="/">
          ← Home
        </Link>
      </p>
      <p className="section-kicker">Digital products</p>
      <h1>Software &amp; tools</h1>
      <p className="lede">
        Software and services for local shops — month to month, no long contract. These are not mill-parts cart items.
      </p>
      {products.length ? (
        <div className="grid-catalog">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p>Nothing listed yet. Check back soon, or request a custom quote.</p>
      )}
      <p style={{ marginTop: 24 }}>
        <Link className="btn" href="/physical">
          Browse physical products
        </Link>
      </p>
    </div>
  );
}
