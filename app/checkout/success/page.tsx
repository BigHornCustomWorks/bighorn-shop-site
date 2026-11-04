import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Order Received | Big Horn Custom Works, Sheridan, WY",
  description:
    "Thanks for your order from Big Horn Custom Works in Sheridan, WY. Stripe will email your receipt, and Clint ships from the Sheridan shop.",
  path: "/checkout/success",
  noindex: true,
});


export default function SuccessPage() {
  return (
    <div className="wrap">
      <h1>Order received</h1>
      <p>Stripe has the payment. You will get a receipt from Stripe. Clint ships from Sheridan, WY.</p>
      <Link className="btn" href="/shop">
        Back to shop
      </Link>
    </div>
  );
}
