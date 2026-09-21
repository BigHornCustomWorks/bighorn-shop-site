import Link from "next/link";
import { HeroMedia } from "@/components/HeroMedia";
import { QuoteForm } from "@/components/QuoteForm";
import { readStore } from "@/lib/store";
import { safeUrl } from "@/lib/sanitize";

export default async function HomePage() {
  const store = await readStore();
  const site = store.site;
  const rsUrl = safeUrl(site.repairStatusUrl) || "https://repairstatus.site/";
  const physicalPhoto =
    store.products.find((p) => p.kind === "physical" && (p.photos?.[0] || p.media?.[0]))?.photos?.[0] ||
    store.products.find((p) => p.kind === "physical")?.media?.[0] ||
    "/products/spindle-1.jpg";
  const signPhoto =
    (store.metalSigns.media || []).find((src) => src && !src.match(/\.(mp4|webm|mov)(\?|$)/i)) ||
    "/gallery/gallery-cta-hero.jpg";

  return (
    <>
      <HeroMedia photo={site.heroUrl || "/hero.jpg"} video={site.heroVideoUrl || ""} />
      <div className="tagline-bar">
        <p className="tagline-line">
          <span>{site.taglineLine1}</span>
          <span>{site.taglineLine2}</span>
          <span>{site.taglineLine3}</span>
        </p>
      </div>

      <div className="wrap">
        <div className="intro">
          <p className="section-kicker">Who we are</p>
          <p className="lede">
            Clint Stussi’s Sheridan shop — custom design, fabrication, and the software local businesses need on the
            floor.
          </p>
        </div>

        <div className="gate-head">
          <p className="section-kicker">Explore</p>
          <h2>What are you looking for?</h2>
        </div>

        <Link className="gallery-cta signs-cta" href="/signs">
          <div className="gallery-cta-media">
            <img src={signPhoto} alt="CNC plasma-cut metal signs" />
          </div>
          <div className="gallery-cta-panel">
            <span className="badge">Metal signs</span>
            <h2>Plasma-cut signs</h2>
            <p>
              Ready-made pieces as Clint builds them, plus custom sizes. Local pickup in Sheridan — no shipping charge.
            </p>
            <span className="btn btn-spark">Shop metal signs →</span>
          </div>
        </Link>

        <div className="gates">
          <div className="gate-col">
            <div>
              <h2 className="gate-title digital">Digital Products</h2>
              <p className="gate-title-sub">Software &amp; tools</p>
            </div>
            <Link className="gate digital" href="/digital">
              <img className="bg gate-logo-bg" src="/products/repair-status-thumb-dark.png" alt="" />
              <div className="shade" />
              <div className="content">
                <span className="badge">Software</span>
                <h3>Software &amp; apps</h3>
                <p>Repair Status and other tools for shops — month to month.</p>
                <p className="includes">Includes: Repair Status · Google review collection (coming soon)</p>
                <span className="btn btn-spark">Enter digital products →</span>
              </div>
            </Link>
          </div>

          <div className="gate-col">
            <div>
              <h2 className="gate-title physical">Physical Products</h2>
              <p className="gate-title-sub">Mill accessories &amp; fab goods</p>
            </div>
            <Link className="gate" href="/physical">
              <img className="bg" src={physicalPhoto} alt="" />
              <div className="shade" />
              <div className="content">
                <span className="badge">Shop floor</span>
                <h3>Parts &amp; fab goods</h3>
                <p>Mill accessories and other physical goods from the Sheridan shop.</p>
                <p className="includes">Includes: mill accessories · 3D-printed parts</p>
                <span className="btn btn-bronze">Enter physical products →</span>
              </div>
            </Link>
          </div>
        </div>


        <div className="third">
          <div className="card">
            <p className="section-kicker">Custom work</p>
            <h3>Need something that doesn’t exist yet?</h3>
            <p>One-offs, mill upgrades, fab, repair, or a floor tool. Quote form — not checkout.</p>
            <Link className="btn btn-outline-ink" href="/custom">
              Request a quote
            </Link>
          </div>
          <div className="card card-weld">
            <p className="section-kicker kicker-spark">Quick link</p>
            <h3>Already know Repair Status?</h3>
            <p className="card-weld-p">Skip the catalog and go straight to the live product.</p>
            <a className="btn btn-spark" href={rsUrl} rel="noreferrer">
              Open repairstatus.site
            </a>
          </div>
        </div>

        <div className="home-quote-block">
          <p className="section-kicker">Or send a note</p>
          <h2>Custom quote</h2>
          <QuoteForm />
        </div>
      </div>
    </>
  );
}
