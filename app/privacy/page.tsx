import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Privacy Policy | Big Horn Custom Works, Sheridan, WY",
  description:
    "How Big Horn Custom Works LLC in Sheridan, WY handles the information you send on quote forms and catalog orders. We do not sell your information.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <div className="wrap">
      <h1>Privacy policy</h1>
      <p>
        Big Horn Custom Works LLC collects the name, email, phone, and project details you send on a quote form, and the
        information Stripe needs to complete a catalog purchase (card details are handled by Stripe, not stored on this
        site). We use that information to quote, build, ship, and support your order.
      </p>
      <p>
        We do not sell your information. Product photos you upload with a quote stay in the shop inbox so Clint can see
        the job. Questions: bighorncustomworks@gmail.com.
      </p>
    </div>
  );
}
