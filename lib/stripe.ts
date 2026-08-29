import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import type { Product, ShopStore } from "./types";
import { stripeSecret } from "./store";
import { cleanStr, safeUrl } from "./sanitize";

export function stripeClient(store: ShopStore): Stripe | null {
  const key = stripeSecret(store);
  if (!key) return null;
  return new Stripe(key);
}

export function siteUrl(): string {
  return (
    cleanStr(process.env.NEXT_PUBLIC_SITE_URL) ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}

function integrationId(): string {
  return `bhcw-shop-${randomBytes(4).toString("hex")}`;
}

export async function createCheckoutSession(
  store: ShopStore,
  items: { product: Product; quantity: number; variant?: string }[],
  customerEmail?: string,
) {
  const stripe = stripeClient(store);
  if (!stripe) throw new Error("Stripe is not configured.");
  const origin = siteUrl();

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => {
    const variant = cleanStr(item.variant);
    const name = variant ? `${item.product.name} (${variant})` : item.product.name;
    const images = (item.product.photos.length ? item.product.photos : item.product.media)
      .map(safeUrl)
      .filter(Boolean)
      .slice(0, 8);
    const photo =
      images[0] && images[0].startsWith("/") ? `${origin}${images[0]}` : images[0];
    return {
      quantity: Math.max(1, Math.min(item.quantity, 20)),
      price_data: {
        currency: "usd",
        unit_amount: item.product.priceCents,
        product_data: {
          name,
          description: cleanStr(item.product.description).slice(0, 400) || undefined,
          images: photo ? [photo] : undefined,
        },
      },
    };
  });

  const needsShipping = items.some((i) => i.product.kind !== "digital");

  if (needsShipping && store.site.shippingCents > 0) {
    line_items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: store.site.shippingCents,
        product_data: { name: "Shipping from Sheridan, WY" },
      },
    });
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items,
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel`,
    metadata: {
      shop: "big-horn-custom-works",
      items: items.map((i) => `${i.product.slug}:${i.variant || "default"}x${i.quantity}`).join(","),
    },
  };

  if (needsShipping) {
    params.shipping_address_collection = { allowed_countries: ["US"] };
  }

  if (customerEmail) params.customer_email = customerEmail;

  try {
    return await stripe.checkout.sessions.create({
      ...params,
      integration_identifier: integrationId(),
    } as Stripe.Checkout.SessionCreateParams);
  } catch {
    return await stripe.checkout.sessions.create(params);
  }
}
