import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyBox } from "@/components/BuyBox";
import { ProductGallery } from "@/components/ProductGallery";
import { categorySlug, productBySlug, readStore } from "@/lib/store";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await readStore();
  const product = productBySlug(store, slug);
  if (!product) notFound();
  const cat = categorySlug(product.category);

  return (
    <div className="wrap">
      <p className="back-row">
        <Link className="back-link" href="/">
          ← Home
        </Link>
        <Link className="back-link" href="/shop">
          Shop
        </Link>
        <Link className="back-link" href={`/shop?category=${cat}`}>
          {product.category}
        </Link>
      </p>
      <div className="grid-2">
        <ProductGallery media={product.media} name={product.name} />
        <div>
          <p className="section-kicker">
            {product.category}
            {product.kind === "digital" ? " · Digital" : ""}
          </p>
          <h1>{product.name}</h1>
          <p style={{ whiteSpace: "pre-wrap" }}>{product.description}</p>
          <BuyBox product={product} />
          {product.kind === "digital" ? (
            <p className="note" style={{ marginTop: 16 }}>
              {product.digitalNote ||
                "Digital item. After payment, Clint emails the file. Nothing ships."}
            </p>
          ) : (
            <p className="note" style={{ marginTop: 16 }}>
              {store.site.shippingNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
