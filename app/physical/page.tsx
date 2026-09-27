import Link from "next/link";
import { physicalCategoryDoors, readStore } from "@/lib/store";
import { isVideoSrc } from "@/lib/video";

export default async function PhysicalPage() {
  const store = await readStore();
  const doors = physicalCategoryDoors(store);
  const signPhoto =
    (store.metalSigns.media || []).find((src) => src && !isVideoSrc(src)) || "/gallery/gallery-cta-hero.jpg";

  return (
    <div className="wrap">
      <p className="back-row">
        <Link className="back-link" href="/">
          ← Home
        </Link>
      </p>
      <p className="section-kicker">Physical products</p>
      <h1>Pick a line</h1>
      <p className="lede">
        Mill accessories, dogs, and other shop goods are in their own rooms — not one mixed pile. Metal signs live on
        the Signs page.
      </p>

      {doors.length ? (
        <div className="cat-doors">
          {doors.map((d) => (
            <Link key={d.slug} className="cat-door" href={`/physical/${d.slug}`}>
              <img className="bg" src={d.photo} alt="" />
              <div className="shade" />
              <div className="content">
                <span className="badge">
                  {d.count} {d.count === 1 ? "item" : "items"}
                </span>
                <h2>{d.name}</h2>
                <span className="btn btn-bronze">Open {d.name} →</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p>Nothing listed yet. Categories you add in Master Control show up here once they have a visible product.</p>
      )}

      <Link className="gallery-cta signs-cta physical-signs-cta" href="/signs">
        <div className="gallery-cta-media">
          <img src={signPhoto} alt="" />
        </div>
        <div className="gallery-cta-panel">
          <span className="badge">Metal signs</span>
          <h2>{store.metalSigns.heading || "CNC plasma-cut signs"}</h2>
          <p>Premade signs and custom sizes. Local pickup in Sheridan — no shipping charge.</p>
          <span className="btn btn-spark">Shop metal signs →</span>
        </div>
      </Link>
    </div>
  );
}
