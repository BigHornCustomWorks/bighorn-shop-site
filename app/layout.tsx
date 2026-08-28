import type { Metadata } from "next";
import { CartProvider } from "@/components/CartProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { VisitBeacon } from "@/components/VisitBeacon";
import { readStore } from "@/lib/store";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const store = await readStore();
    return {
      title: {
        default: `${store.site.companyName} · Sheridan, WY`,
        template: `%s · ${store.site.companyName}`,
      },
      description: `${store.site.taglineLine1} ${store.site.taglineLine2} ${store.site.taglineLine3}`,
    };
  } catch {
    return { title: "Big Horn Custom Works" };
  }
}

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
        </CartProvider>
      </body>
    </html>
  );
}
