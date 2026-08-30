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

/**
 * Stripe caps a session at 5 shipping options. Charging shipping as a normal
 * line item (the old approach) hides it from Stripe Tax and from the shipping
 * totals, so it has to go through shipping_options instead.
 */
function shippingOptionsFor(
  store: ShopStore,
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  return store.site.shippingOptions.slice(0, 5).map((opt) => {
    const rate: Stripe.Checkout.SessionCreateParams.ShippingOption.ShippingRateData = {
      type: "fixed_amount",
      fixed_amount: { amount: opt.amountCents, currency: "usd" },
      display_name: opt.label,
      tax_behavior: "exclusive",
    };
    if (opt.minDays > 0 && opt.maxDays > 0) {
      rate.delivery_estimate = {
        minimum: { unit: "business_day", value: opt.minDays },
        maximum: { unit: "business_day", value: opt.maxDays },
      };
    }
    return { shipping_rate_data: rate };
  });
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
    const quantity = Math.max(1, Math.min(item.quantity, 20));
    if (item.product.stripePriceId && !variant) {
      return { quantity, price: item.product.stripePriceId };
    }
    return {
      quantity,
      price_data: {
        currency: "usd",
        unit_amount: item.product.priceCents,
        tax_behavior: "exclusive",
        product_data: {
          name,
          description: cleanStr(item.product.description).slice(0, 400) || undefined,
          images: photo ? [photo] : undefined,
        },
      },
    };
  });

  const needsShipping = items.some((i) => i.product.kind !== "digital");

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
    const options = shippingOptionsFor(store);
    if (options.length) params.shipping_options = options;
  }

  if (store.settings.taxEnabled) {
    params.automatic_tax = { enabled: true };
    // Stripe Tax has to have an address to rate against. Physical orders get
    // one from shipping collection; digital-only orders need a billing one.
    if (!needsShipping) params.billing_address_collection = "required";
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
