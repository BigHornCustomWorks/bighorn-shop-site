import type { ShopStore } from "./types";
import { stripeClient } from "./stripe";

const BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

function brandName(brand: string): string {
  const key = brand.trim().toLowerCase();
  return BRANDS[key] || key.replace(/_/g, " ");
}

/** How this checkout was paid, from the Stripe charge. Empty if Stripe has no card on it. */
export async function paidWithLabel(store: ShopStore, sessionId: string): Promise<string> {
  const id = sessionId.trim();
  if (!id.startsWith("cs_")) return "";
  const stripe = stripeClient(store);
  if (!stripe) return "";
  try {
    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: ["payment_intent.latest_charge"],
    });
    const intent = session.payment_intent;
    if (!intent || typeof intent === "string") return "";
    const charge = intent.latest_charge;
    if (!charge || typeof charge === "string") return "";
    const details = charge.payment_method_details;
    if (!details || details.type !== "card" || !details.card) {
      return details?.type ? details.type.replace(/_/g, " ") : "";
    }
    const brand = brandName(details.card.brand || "card");
    const funding =
      details.card.funding === "credit" || details.card.funding === "debit" || details.card.funding === "prepaid"
        ? `${details.card.funding} `
        : "";
    const last4 = details.card.last4 ? ` ending ${details.card.last4}` : "";
    const card = `${brand} ${funding}card${last4}`.replace(/\s+/g, " ").trim();
    const wallet = details.card.wallet?.type;
    if (wallet === "apple_pay") return `Apple Pay (${card})`;
    if (wallet === "google_pay") return `Google Pay (${card})`;
    return card;
  } catch {
    return "";
  }
}
