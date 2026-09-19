import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { SignEstimator } from "@/components/SignEstimator";
import { readStore, visibleProducts } from "@/lib/store";
import { isVideoSrc } from "@/lib/video";

export default async function SignsPage() {
  const store = await readStore();
  const signs = store.metalSigns;
  const catalog = visibleProducts(store).filter((p) => p.kind === "sign");
  const media = signs.media || [];
  const firstPhoto = media.find((src) => src && !isVideoSrc(src)) || "/gallery/gallery-cta-hero.jpg";

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

      {media.length ? (
        <div className="sign-media" style={{ margin: "18px 0 28px" }}>
          <ProductGallery media={media} name={signs.heading || "Metal signs"} />
        </div>
      ) : (
        <img
          src={firstPhoto}
          alt=""
          style={{ width: "100%", maxHeight: 420, objectFit: "cover", margin: "18px 0 28px" }}
        />
      )}

      {signs.note ? <p className="note">{signs.note}</p> : null}

      <section style={{ marginTop: 28 }}>
        <p className="section-kicker">Ready to ship</p>
        <h2>Pre-made signs</h2>
        <p className="muted">Pieces Clint has already cut — buy as listed. New photos land here as he makes them.</p>
        {catalog.length ? (
          <div className="grid-catalog">
            {catalog.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="muted">Nothing listed yet. Custom sizes are below, or request a quote.</p>
          </div>
        )}
      </section>

      {signs.visible ? (
        <section style={{ marginTop: 36 }}>
          <p className="section-kicker">Custom size</p>
          <h2>Need a specific size?</h2>
          <SignEstimator config={signs} shippingNote={store.site.shippingNote} />
        </section>
      ) : (
        <div className="card" style={{ marginTop: 20 }}>
          <p className="section-kicker">Coming soon</p>
          <h3>Size estimator is off</h3>
          <p className="muted">Send a size and we’ll quote it.</p>
          <Link className="btn" href="/custom">
            Request a custom sign quote
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
