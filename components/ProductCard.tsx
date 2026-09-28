import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatUsd } from "@/lib/money";
import { firstPhoto } from "@/lib/video";
import { stockLabel } from "@/lib/stock";
import { listedVariants, lowestVariantPrice, variantPriceSpread } from "@/lib/variant-price";
import { isRepairStatusProduct, REPAIR_STATUS_INFO_URL } from "@/lib/repair-status";

export function ProductCard({ product, showOptions = false }: { product: Product; showOptions?: boolean }) {
  const photo = firstPhoto(product) || "/logo.png";
  const blurb = product.description.slice(0, 72);
  const options = listedVariants(product);
  const stock = stockLabel(product);
  const repairStatus = isRepairStatusProduct(product);
  const card = (
    <>
      <div className="product-card-media">
        <img src={photo} alt="" />
        {(product.videos || []).length ? <span className="badge-media">Video</span> : null}
        {/coming soon/i.test(product.priceLabel || "") ? <span className="badge-media">Coming soon</span> : null}
      </div>
      <div className="pad">
        <p className="card-meta">
          {product.sku ? `Item ${product.sku} · ` : ""}
          {product.category}
          {product.kind === "digital" ? " · Digital" : product.kind === "sign" ? " · Metal sign" : ""}
        </p>
        <h3>{product.name}</h3>
        <p className="price">
          {repairStatus
            ? "Opens Repair Status"
            : product.priceLabel ||
              (variantPriceSpread(product)
                ? `From ${formatUsd(lowestVariantPrice(product))}`
                : formatUsd(lowestVariantPrice(product) || product.priceCents))}
        </p>
        {stock && !repairStatus ? <p className="muted card-blurb">{stock}</p> : null}
        {repairStatus ? null : showOptions && options.length ? (
          <ul className="face-options">
            {options.map((v) => (
              <li key={v.id}>
                {v.name}
                {v.onHand == null ? "" : v.onHand <= 0 ? " — made to order" : ` — ${v.onHand} ready`}
              </li>
            ))}
          </ul>
        ) : options.length > 1 ? (
          <p className="muted card-blurb">{options.length} sizes / finishes — pick on the next page</p>
        ) : options.length === 1 ? (
          <p className="muted card-blurb">{options[0].name}</p>
        ) : null}
        <p className="muted card-blurb">
          {repairStatus
            ? "Information and signup are on repairstatus.site. Not sold in this shop."
            : blurb}
          {!repairStatus && product.description.length > 72 ? "…" : ""}
        </p>
      </div>
    </>
  );
  if (repairStatus) {
    return (
      <a className="product-card" href={REPAIR_STATUS_INFO_URL} rel="noreferrer">
        {card}
      </a>
    );
  }
  return (
    <Link className="product-card" href={`/shop/${product.slug}`}>
      {card}
    </Link>
  );
}
