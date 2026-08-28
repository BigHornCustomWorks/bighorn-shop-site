"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./CartProvider";
import type { Product } from "@/lib/types";
import { formatUsd } from "@/lib/money";

export function BuyBox({ product }: { product: Product }) {
  const { add } = useCart();
  const router = useRouter();
  const [variant, setVariant] = useState(product.variants[0]?.name || "");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function addToCart() {
    add(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        priceCents: product.priceCents,
        photo: product.photos[0] || "",
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

  return (
    <div>
      <p className="price">{formatUsd(product.priceCents)}</p>
      {product.variants.length ? (
        <label>
          Color
          <select value={variant} onChange={(e) => setVariant(e.target.value)}>
            {product.variants.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name}
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
    </div>
  );
}
