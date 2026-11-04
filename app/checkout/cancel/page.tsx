import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Checkout Canceled | Big Horn Custom Works, Sheridan, WY",
  description:
    "Checkout was canceled and no charge was made. Your cart from Big Horn Custom Works in Sheridan, WY is still saved on this device.",
  path: "/checkout/cancel",
  noindex: true,
});


export default function CancelPage() {
  return (
    <div className="wrap">
      <h1>Checkout canceled</h1>
      <p>No charge. Your cart is still on this device if you want to try again.</p>
      <Link className="btn" href="/cart">
        Return to cart
      </Link>
    </div>
  );
}
