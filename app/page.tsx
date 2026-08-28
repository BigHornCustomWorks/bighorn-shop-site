import Link from "next/link";
import { HeroMedia } from "@/components/HeroMedia";
import { ProductCard } from "@/components/ProductCard";
import { QuoteForm } from "@/components/QuoteForm";
import { readStore, visibleProducts } from "@/lib/store";
import { safeUrl } from "@/lib/sanitize";

export default async function HomePage() {
  const store = await readStore();
  const products = visibleProducts(store).slice(0, 3);
  const site = store.site;
  const rsUrl = safeUrl(site.repairStatusUrl);

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
      <div className="hero-actions wrap" style={{ paddingTop: 16, paddingBottom: 0 }}>
        <Link className="btn btn-bronze" href="/shop">
          Shop parts
        </Link>
        <Link className="btn" href="/custom">
          Request a quote
        </Link>
      </div>

      <div className="wrap">
        <p className="section-kicker">Who we are</p>
        <p className="lede">{site.whoWeAre}</p>
        <hr className="rule" />
        <p className="section-kicker">What we make</p>
        <h2>Custom fab, 3D, mill upgrades, one-offs</h2>
        <p className="lede">{site.whatWeMake}</p>

        <hr className="rule" />
        <p className="section-kicker">Catalog</p>
        <h2>On the shelf</h2>
        <div className="grid-catalog">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        <p style={{ marginTop: 16 }}>
          <Link className="btn" href="/shop">
            All products
          </Link>
        </p>

        <div className="rs-line">
          {rsUrl ? (
            <a href={rsUrl} rel="noreferrer">
              {site.repairStatusLabel}
            </a>
          ) : (
            site.repairStatusLabel
          )}
          {" — "}
          {site.repairStatusLine}
        </div>

        <div className="grid-2">
          <div>
            <p className="section-kicker">Custom work</p>
            <h2>Need something that does not exist yet?</h2>
            <p>One-offs, mill upgrades, fab, repair, or a tool the floor actually needs. Not a catalog checkout — tell Clint what you need.</p>
            <QuoteForm />
          </div>
          <div className="card">
            <div className="pad">
              <p className="section-kicker">Shop</p>
              <h3>Sheridan, Wyoming</h3>
              <p>{site.aboutBody.split("\n")[0]}</p>
              <Link href="/about">About the shop →</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
