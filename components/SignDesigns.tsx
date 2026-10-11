"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./CartProvider";
import { formatUsd } from "@/lib/money";
import { designCartId, designsForSale, saleSizes, sizeLabel } from "@/lib/sign-designs";
import type { SignDesign, SignDesignSize } from "@/lib/types";

export function SignDesigns({ designs }: { designs: SignDesign[] }) {
  const ready = designsForSale(designs);
  if (!ready.length) return null;

  return (
    <section style={{ marginTop: 28 }}>
      <p className="section-kicker">Artwork ready to cut</p>
      <h2>Sign designs ready for sale</h2>
      <p className="muted">
        These designs are ready to cut in the sizes and prices listed. Add one to the cart, then choose shipping or
        free pickup in Sheridan.
      </p>
      <div className="sign-designs">
        {ready.map((design) => (
          <DesignCard key={design.id} design={design} />
        ))}
      </div>
    </section>
  );
}

function DesignCard({ design }: { design: SignDesign }) {
  const sizes = saleSizes(design);
  const { add } = useCart();
  const router = useRouter();
  const [sizeId, setSizeId] = useState(sizes.length === 1 ? sizes[0].id : "");
  const picked = sizes.find((size) => size.id === sizeId) || null;

  function addToCart(size: SignDesignSize) {
    add(
      {
        productId: designCartId(design.id, size.id),
        slug: "",
        name: design.name,
        priceCents: size.priceCents,
        photo: design.image,
        variant: sizeLabel(size),
        shopHref: "/signs",
      },
      1,
    );
    router.push("/cart");
  }

  return (
    <article className="sign-design">
      <img src={design.image} alt={design.name} />
      <h3>{design.name}</h3>
      {sizes.length === 1 ? (
        <p>
          {sizeLabel(sizes[0])} · <strong>{formatUsd(sizes[0].priceCents)}</strong>
        </p>
      ) : (
        <label>
          Size
          <select value={sizeId} onChange={(e) => setSizeId(e.target.value)}>
            <option value="">Choose a size</option>
            {sizes.map((size) => (
              <option key={size.id} value={size.id}>
                {sizeLabel(size)} — {formatUsd(size.priceCents)}
              </option>
            ))}
          </select>
        </label>
      )}
      {sizes.length > 1 && picked ? <p className="price">{formatUsd(picked.priceCents)}</p> : null}
      <button
        type="button"
        className="btn btn-bronze"
        disabled={!picked}
        onClick={() => picked && addToCart(picked)}
      >
        {picked ? "Add to cart" : "Choose a size"}
      </button>
    </article>
  );
}
