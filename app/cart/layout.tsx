import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// The cart page is a client component, so its metadata lives here.
export const metadata: Metadata = pageMeta({
  title: "Your Cart | Big Horn Custom Works, Sheridan, WY",
  description:
    "Review your cart from Big Horn Custom Works in Sheridan, WY, get live shipping rates for your ZIP, or choose local pickup, then pay securely with Stripe.",
  path: "/cart",
  noindex: true,
});

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
