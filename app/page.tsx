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
    store.products.find((p) => p.kind !== "digital" && (p.photos?.[0] || p.media?.[0]))?.photos?.[0] ||
    store.products.find((p) => p.kind !== "digital")?.media?.[0] ||
    "/products/spindle-1.jpg";

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
            floor. Pick a path below.
          </p>
        </div>

        <div className="gate-head">
          <p className="section-kicker">Explore</p>
          <h2>What are you looking for?</h2>
          <p>Homepage stays a front door. Products live one click in — so software isn’t buried under mill parts.</p>
        </div>

        <div className="gates">
          <div className="gate-col">
            <div>
              <h2 className="gate-title digital">Digital Products</h2>
              <p className="gate-title-sub">Software &amp; tools · left side matches the CAD hero</p>
            </div>
            <Link className="gate digital" href="/digital">
              <img className="bg gate-logo-bg" src="/products/repair-status-thumb-dark.png" alt="" />
              <div className="shade" />
              <div className="content">
                <span className="badge">Pushing this</span>
                <h3>Software &amp; apps</h3>
                <p>Repair Status and other tools for shops — month to month, not a mill-parts cart.</p>
                <p className="includes">Includes: Repair Status · Google review collection (coming soon)</p>
                <span className="btn btn-spark">Enter digital products →</span>
              </div>
            </Link>
          </div>

          <div className="gate-col">
            <div>
              <h2 className="gate-title physical">Physical Products</h2>
              <p className="gate-title-sub">Parts, signs &amp; fab goods · one click in</p>
            </div>
            <Link className="gate" href="/physical">
              <img className="bg" src={physicalPhoto} alt="" />
              <div className="shade" />
              <div className="content">
                <span className="badge">Shop floor &amp; signs</span>
                <h3>Parts, signs &amp; fab goods</h3>
                <p>One door into everything you can buy as a physical product — not a wall of SKUs on the home page.</p>
                <p className="includes">Includes: mill accessories · CNC plasma-cut signs · size estimator</p>
                <span className="btn btn-bronze">Enter physical products →</span>
              </div>
            </Link>
          </div>
        </div>


        <section className="gallery-cta">
          <div className="gallery-cta-media">
            <img src="/gallery/gallery-cta-hero.jpg" alt="Sample · Decorative CNC plasma-cut mountain wall art" />
          </div>
          <div className="gallery-cta-panel">
            <span className="badge">New · Photo gallery</span>
            <h2>See the work</h2>
            <p>
              CNC plasma-cut signs on real homes and businesses — and more as Clint adds sections.
            </p>
            <Link className="btn btn-spark" href="/gallery">
              Open photo gallery →
            </Link>
          </div>
        </section>

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
