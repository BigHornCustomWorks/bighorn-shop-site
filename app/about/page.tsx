import { readStore } from "@/lib/store";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "About the Shop in Sheridan, WY | Big Horn Custom Works",
  description:
    "Big Horn Custom Works LLC is Clint Stussi's Sheridan, WY shop for custom design, metal fabrication, welding, repair, signs, 3D printing and shop software.",
  path: "/about",
});

export default async function AboutPage() {
  const { site } = await readStore();
  return (
    <div className="wrap">
      <p className="section-kicker">About</p>
      <h1>About {site.companyName}</h1>
      <p className="lede" style={{ whiteSpace: "pre-wrap" }}>
        {site.aboutBody}
      </p>
      <p>
        {site.location}. {site.legalName}.
      </p>
    </div>
  );
}
