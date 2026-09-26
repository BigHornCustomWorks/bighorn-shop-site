"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "./CartProvider";
import type { Product } from "@/lib/types";
import { formatUsd } from "@/lib/money";
import { listedVariants, lowestVariantPrice, variantPriceSpread, variantUnitPrice } from "@/lib/variant-price";

export function BuyBox({ product }: { product: Product }) {
  const { add } = useCart();
  const router = useRouter();
  const options = listedVariants(product);
  const [variant, setVariant] = useState(options[0]?.name || "");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unitPrice = variantUnitPrice(product, variant);
  const priceText =
    product.priceLabel ||
    (variantPriceSpread(product) && !variant
      ? `From ${formatUsd(lowestVariantPrice(product))}`
      : formatUsd(unitPrice));
  const external = (product.externalUrl || "").trim();
  const comingSoon = /coming soon/i.test(product.priceLabel || "") || /coming soon/i.test(product.digitalNote || "");
  const linkOut = Boolean(external);

  function addToCart() {
    add(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        priceCents: unitPrice,
        photo: product.photos[0] || product.media[0] || "",
        variant,
      },
      qty,
    );
    router.push("/cart");
  }

  async function buyNow() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ productId: product.id, quantity: qty, variant }],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || "Checkout is not ready.");
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setBusy(false);
    }
  }

  if (product.kind === "sign" && product.priceCents <= 0 && !linkOut) {
    return (
      <div>
        <p className="price">{priceText === formatUsd(0) ? "Size-based" : priceText}</p>
        <div className="hero-actions" style={{ marginTop: 14 }}>
          <Link className="btn btn-bronze" href="/signs">
            Get a size estimate
          </Link>
        </div>
      </div>
    );
  }

  if (comingSoon && !linkOut) {
    return (
      <div>
        <p className="price">{priceText}</p>
        <div className="hero-actions" style={{ marginTop: 14 }}>
          <Link className="btn btn-bronze" href="/contact">
            Get updates
          </Link>
        </div>
        {product.digitalNote ? (
          <p className="note" style={{ marginTop: 10 }}>
            {product.digitalNote}
          </p>
        ) : null}
      </div>
    );
  }

  if (linkOut) {
    const isInternal = external.startsWith("/");
    return (
      <div>
        <p className="price">{priceText}</p>
        <div className="hero-actions" style={{ marginTop: 14 }}>
          {isInternal ? (
            <Link className="btn btn-bronze" href={external}>
              {comingSoon ? "Get updates" : "Try the demo"}
            </Link>
          ) : (
            <a className="btn btn-bronze" href={external} rel="noreferrer">
              {comingSoon ? "Get updates" : "Try the demo"}
            </a>
          )}
          <Link className="btn" href="/contact">
            Contact
          </Link>
        </div>
        {product.digitalNote ? (
          <p className="note" style={{ marginTop: 10 }}>
            {product.digitalNote}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <p className="price">{priceText}</p>
      {options.length ? (
        <label>
          Size / finish
          <select value={variant} onChange={(e) => setVariant(e.target.value)}>
            {options.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name}
                {v.priceCents > 0 || variantPriceSpread(product) ? ` — ${formatUsd(variantUnitPrice(product, v.name))}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {product.variantNote ? <p className="note">{product.variantNote}</p> : null}
      <label>
        Qty
        <input
          type="number"
          min={1}
          max={20}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value) || 1)}
        />
      </label>
      <div className="hero-actions" style={{ marginTop: 14 }}>
        <button className="btn" type="button" onClick={addToCart}>
          Add to cart
        </button>
        <button className="btn btn-bronze" type="button" onClick={buyNow} disabled={busy}>
          {busy ? "Opening checkout…" : "Buy now"}
        </button>
      </div>
      {error ? <p className="err">{error}</p> : null}
      {product.kind === "digital" ? (
        <p className="note" style={{ marginTop: 10 }}>
          Digital — nothing ships. {product.digitalNote}
        </p>
      ) : null}
    </div>
  );
}
