import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatUsd } from "@/lib/money";
import { firstPhoto } from "@/lib/video";
import { listedVariants, lowestVariantPrice, variantPriceSpread } from "@/lib/variant-price";

export function ProductCard({ product }: { product: Product }) {
  const photo = firstPhoto(product) || "/logo.png";
  const blurb = product.description.slice(0, 72);
  const options = listedVariants(product);
  return (
    <Link className="product-card" href={`/shop/${product.slug}`}>
      <div className="product-card-media">
        <img src={photo} alt="" />
        {(product.videos || []).length ? <span className="badge-media">Video</span> : null}
        {/coming soon/i.test(product.priceLabel || "") ? <span className="badge-media">Coming soon</span> : null}
      </div>
      <div className="pad">
        <p className="card-meta">
          {product.category}
          {product.kind === "digital" ? " · Digital" : product.kind === "sign" ? " · Metal sign" : ""}
        </p>
        <h3>{product.name}</h3>
        <p className="price">
          {product.priceLabel ||
            (variantPriceSpread(product)
              ? `From ${formatUsd(lowestVariantPrice(product))}`
              : formatUsd(lowestVariantPrice(product) || product.priceCents))}
        </p>
        {options.length > 1 ? (
          <p className="muted card-blurb">{options.length} sizes / finishes — pick on the next page</p>
        ) : options.length === 1 ? (
          <p className="muted card-blurb">{options[0].name}</p>
        ) : null}
        <p className="muted card-blurb">
          {blurb}
          {product.description.length > 72 ? "…" : ""}
        </p>
      </div>
    </Link>
  );
}
