import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatUsd } from "@/lib/money";

export function ProductCard({ product }: { product: Product }) {
  const photo = product.photos[0] || "/logo.png";
  return (
    <Link className="product-card" href={`/shop/${product.slug}`}>
      <img src={photo} alt="" />
      <div className="pad">
        <h3>{product.name}</h3>
        <p className="price">{formatUsd(product.priceCents)}</p>
        <p className="muted">{product.description.slice(0, 140)}{product.description.length > 140 ? "…" : ""}</p>
      </div>
    </Link>
  );
}
