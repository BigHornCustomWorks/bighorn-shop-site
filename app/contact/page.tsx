import { QuoteForm } from "@/components/QuoteForm";
import { readStore } from "@/lib/store";
import { safeUrl } from "@/lib/sanitize";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Contact & Quotes, Sheridan, WY | Big Horn Custom Works",
  description:
    "Contact Big Horn Custom Works in Sheridan, WY for custom fabrication, welding, repair, metal signs or 3D printing. Email the shop or send a quote request.",
  path: "/contact",
});

export default async function ContactPage() {
  const { site } = await readStore();
  const li = safeUrl(site.linkedinUrl);
  return (
    <div className="wrap">
      <p className="section-kicker">Contact</p>
      <h1>Contact the Sheridan, WY shop</h1>
      <p>
        Email: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
      </p>
      <p>{site.location}</p>
      {li ? (
        <p>
          <a href={li} rel="noreferrer">
            LinkedIn
          </a>
        </p>
      ) : null}
      <h2>Quote</h2>
      <QuoteForm />
    </div>
  );
}
