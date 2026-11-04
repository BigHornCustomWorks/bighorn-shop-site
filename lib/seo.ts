import type { Metadata } from "next";

/**
 * Public origin used for canonical links, Open Graph URLs, robots.txt and
 * sitemap.xml. Set NEXT_PUBLIC_SITE_URL to the live domain once it is
 * attached; until then it falls back to bighorncustomworks.com so canonicals
 * never point at a Vercel preview URL by accident.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bighorncustomworks.com")
  .trim()
  .replace(/\/$/, "");

export const BRAND = "Big Horn Custom Works";
export const DEFAULT_OG_IMAGE = "/hero.jpg";
export const DEFAULT_OG_ALT = "Big Horn Custom Works logo cut in steel with a welder throwing sparks, Sheridan, Wyoming";

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Trim to a length on a word boundary, for descriptions built from admin copy. */
export function clip(text: string, max = 155): string {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 60 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}

/** Append the brand to a page title, dropping it if that would pass ~60 chars. */
export function withBrand(title: string): string {
  const full = `${title} | ${BRAND}`;
  return full.length <= 62 ? full : title;
}

type PageMetaInput = {
  /** Full title as it should appear in the tab — not run through the layout template. */
  title: string;
  description: string;
  /** Path of this page, e.g. "/signs". Used for the canonical and og:url. */
  path: string;
  image?: string;
  imageAlt?: string;
  noindex?: boolean;
};

/**
 * Title, description, self-referencing canonical, Open Graph and Twitter card
 * for one page. Next.js replaces (not merges) openGraph/twitter objects from
 * the layout, so every page builds the whole set here.
 */
export function pageMeta({ title, description, path, image, imageAlt, noindex }: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  const img = absoluteUrl(image || DEFAULT_OG_IMAGE);
  const alt = imageAlt || (image ? title : DEFAULT_OG_ALT);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: BRAND,
      locale: "en_US",
      url,
      title,
      description,
      images: [{ url: img, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: img, alt }],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export const SERVICE_PAGES = [
  {
    slug: "welding-fabrication",
    nav: "Welding & fabrication",
    title: "Welding & Fabrication, Sheridan, WY | Big Horn Custom Works",
    description:
      "Custom welding, metal fabrication and repair in Sheridan, Wyoming — brackets, mounts, replacement parts and one-off builds from Big Horn Custom Works.",
    h1: "Welding & metal fabrication in Sheridan, Wyoming",
    serviceType: "Welding and metal fabrication",
  },
  {
    slug: "metal-signs",
    nav: "Metal signs",
    title: "Plasma-Cut Metal Signs, Sheridan, WY | Big Horn Custom Works",
    description:
      "Custom CNC plasma-cut metal signs for homes, ranches and businesses, designed and cut in Sheridan, Wyoming by Big Horn Custom Works. Pickup or shipping.",
    h1: "Custom plasma-cut metal signs in Sheridan, Wyoming",
    serviceType: "CNC plasma cutting and custom metal signs",
  },
  {
    slug: "3d-printing",
    nav: "3D printing",
    title: "3D Printing in Sheridan, WY | Big Horn Custom Works",
    description:
      "Functional 3D-printed parts, prototypes and replacement pieces printed in Sheridan, Wyoming. Send a photo or drawing to Big Horn Custom Works for a quote.",
    h1: "3D printing in Sheridan, Wyoming",
    serviceType: "3D printing",
  },
  {
    slug: "machined-parts",
    nav: "Machined parts",
    title: "Mill & Lathe Parts, Sheridan, WY | Big Horn Custom Works",
    description:
      "Custom mill and lathe parts, replacement parts no longer made, and small-run machining in Sheridan, Wyoming from Big Horn Custom Works. Request a quote.",
    h1: "Mill & lathe machined parts in Sheridan, Wyoming",
    serviceType: "Mill and lathe machining",
  },
] as const;

export type ServicePage = (typeof SERVICE_PAGES)[number];

/** Serialize JSON-LD safely for a <script> tag (no "</script>" breakout). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function localBusinessJsonLd(site: { companyName: string; legalName: string; contactEmail: string; linkedinUrl?: string; logoUrl?: string }) {
  const logo = absoluteUrl(site.logoUrl || "/logo.png");
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#business`,
    name: site.companyName || BRAND,
    legalName: site.legalName || undefined,
    url: `${SITE_URL}/`,
    logo,
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    email: site.contactEmail || undefined,
    description:
      "Custom metal fabrication, welding, repair, CNC plasma-cut signs, 3D printing, and mill and lathe parts in Sheridan, Wyoming.",
    areaServed: {
      "@type": "City",
      name: "Sheridan",
      containedInPlace: { "@type": "State", name: "Wyoming" },
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: "1205 Lilac Ct",
      addressLocality: "Sheridan",
      addressRegion: "WY",
      postalCode: "82801",
      addressCountry: "US",
    },
    telephone: "+1-307-223-7181",
    // TODO(Clint): add real opening hours, then uncomment.
    // openingHoursSpecification: [
    //   { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "TODO", closes: "TODO" },
    // ],
    sameAs: site.linkedinUrl ? [site.linkedinUrl] : undefined,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Services",
      itemListElement: [
        ...SERVICE_PAGES.map((s) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s.serviceType, url: absoluteUrl(`/services/${s.slug}`) },
        })),
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Repair and replacement parts" } },
      ],
    },
  };
}
