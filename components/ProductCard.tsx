import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatUsd } from "@/lib/money";
import { firstPhoto } from "@/lib/video";

export function ProductCard({ product }: { product: Product }) {
  const photo = firstPhoto(product) || "/logo.png";
  const blurb = product.description.slice(0, 72);
  return (
    <Link className="product-card" href={`/shop/${product.slug}`}>
      <div className="product-card-media">
        <img src={photo} alt="" />
        {(product.videos || []).length ? <span className="badge-media">Video</span> : null}
      </div>
      <div className="pad">
        <p className="card-meta">
          {product.category}
          {product.kind === "digital" ? " · Digital" : ""}
        </p>
        <h3>{product.name}</h3>
        <p className="price">{formatUsd(product.priceCents)}</p>
        <p className="muted card-blurb">
          {blurb}
          {product.description.length > 72 ? "…" : ""}
        </p>
      </div>
    </Link>
  );
}
