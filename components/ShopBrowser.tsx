"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "./ProductCard";
import type { Product, ShopCategory } from "@/lib/types";
import { safeSlug } from "@/lib/sanitize";

export function ShopBrowser({
  products,
  categories,
}: {
  products: Product[];
  categories: ShopCategory[];
}) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (cat !== "all" && safeSlug(p.category) !== cat) return false;
      if (!q) return true;
      return `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q);
    });
  }, [products, categories, query, cat]);

  return (
    <>
      <label className="search-box">
        Search the shop
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, mill, digital…"
        />
      </label>
      {categories.length ? (
        <nav className="cat-pills" aria-label="Product categories">
          <button type="button" className={cat === "all" ? "on" : ""} onClick={() => setCat("all")}>
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cat === safeSlug(c.name) ? "on" : ""}
              onClick={() => setCat(safeSlug(c.name))}
            >
              {c.name}
            </button>
          ))}
        </nav>
      ) : null}
      {shown.length ? (
        <div className="grid-catalog">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p>Nothing in this line right now. Ask for a custom quote.</p>
      )}
    </>
  );
}
