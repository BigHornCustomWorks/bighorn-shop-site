import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Served by Next as /robots.txt (text/plain) — never falls through to the 404 page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
