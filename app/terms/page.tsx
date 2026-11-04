import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Terms of Sale | Big Horn Custom Works, Sheridan, WY",
  description:
    "Terms of sale for catalog parts and custom work from Big Horn Custom Works LLC in Sheridan, WY — quotes, Stripe payments, shipping and lead times.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="wrap">
      <h1>Terms of sale</h1>
      <p>
        Catalog parts are sold as described. Custom work is quoted before it is built. Shipping is from Sheridan,
        Wyoming. Lead times on printed parts can be about 24 hours when inventory is low.
      </p>
      <p>
        Stripe processes catalog payments for Big Horn Custom Works LLC. Custom jobs are quoted separately — this site
        is not a bank portal. Repair Status is a separate product at repairstatus.site and is not sold in this catalog.
      </p>
    </div>
  );
}
