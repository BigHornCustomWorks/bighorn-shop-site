import { notFound } from "next/navigation";
import { BuyBox } from "@/components/BuyBox";
import { ProductGallery } from "@/components/ProductGallery";
import { productBySlug, readStore } from "@/lib/store";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await readStore();
  const product = productBySlug(store, slug);
  if (!product) notFound();

  return (
    <div className="wrap">
      <div className="grid-2">
        <ProductGallery photos={product.photos} name={product.name} />
        <div>
          <p className="section-kicker">Catalog</p>
          <h1>{product.name}</h1>
          <p style={{ whiteSpace: "pre-wrap" }}>{product.description}</p>
          <BuyBox product={product} />
          <p className="note" style={{ marginTop: 16 }}>
            {store.site.shippingNote}
          </p>
        </div>
      </div>
    </div>
  );
}
