import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMeta, SERVICE_PAGES, type ServicePage } from "@/lib/seo";

// Rendered per request like the rest of the site (header/footer copy comes from the store).
// Only the four slugs in SERVICE_PAGES exist; anything else is a real 404.
export const dynamic = "force-dynamic";

function find(slug: string): ServicePage | undefined {
  return SERVICE_PAGES.find((s) => s.slug === slug);
}

export async function generateMetadata({ params }: { params: Promise<{ service: string }> }): Promise<Metadata> {
  const { service } = await params;
  const page = find(service);
  if (!page) return {};
  return pageMeta({ title: page.title, description: page.description, path: `/services/${page.slug}` });
}

/*
 * TODO(Clint): replace every "[Placeholder …]" paragraph below with real copy
 * for that service. Keep "Sheridan, Wyoming" in the intro where it reads well.
 */
const RELATED: Record<string, { href: string; label: string }> = {
  "welding-fabrication": { href: "/gallery", label: "See finished work" },
  "metal-signs": { href: "/signs", label: "Shop metal signs" },
  "3d-printing": { href: "/physical", label: "Shop printed parts" },
  "machined-parts": { href: "/physical/mill-accessories", label: "Shop mill parts" },
};

export default async function ServiceDetailPage({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  const page = find(service);
  if (!page) notFound();
  const related = RELATED[page.slug];

  return (
    <div className="wrap">
      <p className="back-row">
        <Link className="back-link" href="/services">
          ← Services
        </Link>
      </p>
      <p className="section-kicker">Services</p>
      <h1>{page.h1}</h1>
      <p className="lede">
        [Placeholder — intro: one or two sentences on what {page.nav.toLowerCase()} work the Sheridan, Wyoming shop
        takes on and who it is for.]
      </p>
      <div className="hero-actions">
        <Link className="btn btn-bronze" href="/services#request">
          Request a quote
        </Link>
        {related ? (
          <Link className="btn" href={related.href}>
            {related.label}
          </Link>
        ) : null}
      </div>

      <div className="service-list">
        <article>
          <h2>What we make</h2>
          <p>[Placeholder — typical jobs, examples, and materials.]</p>
        </article>
        <article>
          <h2>Equipment &amp; capabilities</h2>
          <p>[Placeholder — machines, processes, and size or material limits.]</p>
        </article>
        <article>
          <h2>How a job works</h2>
          <p>[Placeholder — what to send (photos, measurements, drawings), quoting, and lead time.]</p>
        </article>
        <article>
          <h2>Pickup &amp; shipping</h2>
          <p>[Placeholder — local pickup in Sheridan and shipping options for this kind of work.]</p>
        </article>
      </div>
    </div>
  );
}
