import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BuyBox } from "@/components/BuyBox";
import { ProductGallery } from "@/components/ProductGallery";
import { isRepairStatusProduct, REPAIR_STATUS_INFO_URL } from "@/lib/repair-status";
import { clip, pageMeta, withBrand } from "@/lib/seo";
import { categorySlug, productBySlug, readStore } from "@/lib/store";
import { firstPhoto } from "@/lib/video";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const store = await readStore();
    const product = productBySlug(store, slug);
    if (product) {
      const kind = product.kind === "sign" ? "metal sign" : product.kind === "digital" ? "digital download" : "part";
      const tail = ` A ${kind} from Big Horn Custom Works in Sheridan, WY.`;
      const body = clip(product.description, Math.max(60, 158 - tail.length));
      return pageMeta({
        title: withBrand(`${product.name}, Sheridan, WY`),
        description: body ? `${body}${tail}` : `${product.name}.${tail}`,
        // Canonical uses the product's real slug, so odd-cased or aliased URLs collapse to one.
        path: `/shop/${product.slug}`,
        image: firstPhoto(product) || undefined,
        imageAlt: product.name,
      });
    }
  } catch {
    /* fall through */
  }
  return pageMeta({
    title: "Shop | Big Horn Custom Works, Sheridan, WY",
    description: "Parts, metal signs and files from Big Horn Custom Works in Sheridan, WY.",
    path: `/shop/${slug}`,
  });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await readStore();
  const product = productBySlug(store, slug);
  if (!product) notFound();
  if (isRepairStatusProduct(product)) redirect(REPAIR_STATUS_INFO_URL);
  const cat = categorySlug(product.category);

  return (
    <div className="wrap">
      <p className="back-row">
        <Link className="back-link" href="/">
          ← Home
        </Link>
        <Link
          className="back-link"
          href={product.kind === "digital" ? "/digital" : product.kind === "sign" ? "/signs" : "/physical"}
        >
          {product.kind === "digital" ? "Digital" : product.kind === "sign" ? "Signs" : "Physical"}
        </Link>
        <Link
          className="back-link"
          href={
            product.kind === "digital"
              ? "/digital"
              : product.kind === "sign"
                ? `/signs/${cat}`
                : `/physical/${cat}`
          }
        >
          {product.category}
        </Link>
      </p>
      <div className="grid-2">
        <ProductGallery media={product.media} name={product.name} />
        <div>
          <p className="section-kicker">
            {product.sku ? `Item ${product.sku} · ` : ""}
            {product.category}
            {product.kind === "digital" ? " · Digital" : product.kind === "sign" ? " · Metal sign" : ""}
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
