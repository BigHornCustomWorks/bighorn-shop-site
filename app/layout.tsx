import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { CartProvider } from "@/components/CartProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { VisitBeacon } from "@/components/VisitBeacon";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { readStore } from "@/lib/store";
import "./globals.css";

export const dynamic = "force-dynamic";

// Site-wide defaults. Every public page sets its own title, description,
// canonical, Open Graph and Twitter tags through pageMeta() in lib/seo.ts.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...pageMeta({
    title: "Custom Metal Fabrication & Repair in Sheridan, WY | Big Horn Custom Works",
    description:
      "Custom metal fabrication, welding, repair, plasma-cut signs, 3D printing and mill & lathe parts from Big Horn Custom Works in Sheridan, WY.",
    path: "/",
  }),
  // The layout must not hand its canonical to child pages that forget one.
  alternates: undefined,
  title: { default: "Big Horn Custom Works · Sheridan, WY", template: "%s | Big Horn Custom Works" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let site;
  let uniqueVisitors = 0;
  try {
    const store = await readStore();
    site = store.site;
    uniqueVisitors = store.stats?.uniqueVisitors || 0;
  } catch {
    site = (await import("@/lib/seed")).defaultSite();
  }

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&family=Source+Sans+3:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@1,8..60,500;1,8..60,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <CartProvider>
          <VisitBeacon />
          <Header site={site} />
          <main id="main">{children}</main>
          <Footer site={site} uniqueVisitors={uniqueVisitors} />
          <Analytics />
        </CartProvider>
      </body>
    </html>
  );
}
