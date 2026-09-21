import Link from "next/link";
import { PickupBanner } from "@/components/PickupBanner";
import { ProductCard } from "@/components/ProductCard";
import { SignsCustom } from "@/components/SignsCustom";
import { readStore, visibleProducts } from "@/lib/store";

export default async function SignsPage() {
  const store = await readStore();
  const signs = store.metalSigns;
  const catalog = visibleProducts(store).filter((p) => p.kind === "sign");
  const pickupOn = store.site.pickupEnabled !== false;

  return (
    <div className="wrap">
      <p className="back-row">
        <Link className="back-link" href="/">
          ← Home
        </Link>
        <Link className="back-link" href="/physical">
          Physical
        </Link>
      </p>
      <p className="section-kicker">Metal signs</p>
      <h1>{signs.heading || "CNC plasma-cut metal signs"}</h1>
      <p className="lede">{signs.lede}</p>
      <PickupBanner enabled={pickupOn} label={store.site.pickupLabel} />
      {signs.note ? <p className="note">{signs.note}</p> : null}

      <section style={{ marginTop: 28 }}>
        <p className="section-kicker">Ready to ship</p>
        <h2>Pre-made signs</h2>
        <p className="muted">
          Pieces Clint has already cut — buy as listed. Local pickup is free of shipping. New photos land here as he
          makes them.
        </p>
        {catalog.length ? (
          <div className="grid-catalog">
            {catalog.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="muted">Nothing listed yet. Request a custom sign below.</p>
          </div>
        )}
      </section>

      {signs.visible ? (
        <SignsCustom
          config={signs}
          pickupEnabled={pickupOn}
          pickupLabel={store.site.pickupLabel || "Local pickup — Sheridan, WY"}
        />
      ) : (
        <div className="card" style={{ marginTop: 20 }}>
          <p className="section-kicker">Coming soon</p>
          <h3>Custom requests are off</h3>
          <Link className="btn" href="/custom">
            Request a quote
          </Link>
        </div>
      )}

      <p style={{ marginTop: 28 }}>
        <Link className="btn" href="/gallery">
          See signs in the gallery
        </Link>
      </p>
    </div>
  );
}
