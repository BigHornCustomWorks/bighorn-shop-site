import Link from "next/link";
import { PickupBanner } from "@/components/PickupBanner";
import { SignDesigns } from "@/components/SignDesigns";
import { SignsCustom } from "@/components/SignsCustom";
import { readStore, signCategoryDoors } from "@/lib/store";

export default async function SignsPage() {
  const store = await readStore();
  const signs = store.metalSigns;
  const doors = signCategoryDoors(store);
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
        <p className="section-kicker">Cut to order</p>
        <h2>Custom metal signs</h2>
        <p className="muted">
          Pick a category. Each sign is cut when you order it, in the size and finish listed. Local pickup in Sheridan
          has no shipping charge.
        </p>
        {doors.length ? (
          <div className="cat-doors">
            {doors.map((d) => (
              <Link key={d.slug} className="cat-door" href={`/signs/${d.slug}`}>
                <img className="bg" src={d.photo} alt="" />
                <div className="shade" />
                <div className="content">
                  <span className="badge">
                    {d.count} {d.count === 1 ? "sign" : "signs"}
                  </span>
                  <h2>{d.name}</h2>
                  <span className="btn btn-bronze">Open {d.name} →</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="muted">Nothing listed yet. Request a custom sign below.</p>
          </div>
        )}
      </section>

      <SignDesigns designs={signs.designs || []} />

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
          <Link className="btn" href="/services#request">
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
