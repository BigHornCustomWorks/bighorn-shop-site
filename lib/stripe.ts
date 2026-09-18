import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import type { Product, ShopStore } from "./types";
import type { SignQuote } from "./sign-price";
import { stripeSecret } from "./store";
import { cleanStr, safeUrl } from "./sanitize";
import { isVideoSrc } from "./video";

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
/**
 * Per-item shipping wins when any physical item in the cart carries its own
 * cost, because a way cover and a t-slot cover do not cost the same to post.
 * Items left at 0 ride along free.
 *
 * "highest" assumes the order goes in one box and charges the dearest item.
 * "sum" charges every item and suits goods that each need their own box.
 */
function perItemShipping(
  store: ShopStore,
  items: { product: Product; quantity: number }[],
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  const priced = items.filter(
    (i) => i.product.kind !== "digital" && i.product.shippingCents > 0,
  );
  if (!priced.length) return [];

  const amount =
    store.settings.shippingCombine === "sum"
      ? priced.reduce(
          (total, i) => total + i.product.shippingCents * Math.max(1, i.quantity),
          0,
        )
      : Math.max(...priced.map((i) => i.product.shippingCents));

  return [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount, currency: "usd" },
        display_name: cleanStr(store.site.perItemShippingLabel) || "Shipping",
        tax_behavior: "exclusive",
      },
    },
  ];
}

function shippingOptionsFor(
  store: ShopStore,
  items: { product: Product; quantity: number }[],
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  const fromItems = perItemShipping(store, items);
  if (fromItems.length) return fromItems;

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
    const options = shippingOptionsFor(store, items);
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

function signShippingOptions(
  store: ShopStore,
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  if (store.metalSigns.shippingCents > 0) {
    return [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: store.metalSigns.shippingCents, currency: "usd" },
          display_name: cleanStr(store.site.perItemShippingLabel) || "Shipping",
          tax_behavior: "exclusive",
        },
      },
    ];
  }
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

export async function createSignCheckoutSession(
  store: ShopStore,
  quote: Extract<SignQuote, { ok: true }>,
  customerEmail?: string,
) {
  const stripe = stripeClient(store);
  if (!stripe) throw new Error("Stripe is not configured.");
  const origin = siteUrl();

  const photoSrc = (store.metalSigns.media || []).find((src) => src && !isVideoSrc(src)) || "";
  const photo = photoSrc
    ? photoSrc.startsWith("/")
      ? `${origin}${photoSrc}`
      : safeUrl(photoSrc)
    : "";

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: quote.cents,
          tax_behavior: "exclusive",
          product_data: {
            name: quote.name,
            description: quote.description || undefined,
            images: photo ? [photo] : undefined,
          },
        },
      },
    ],
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel`,
    shipping_address_collection: { allowed_countries: ["US"] },
    metadata: {
      shop: "big-horn-custom-works",
      kind: "sign-estimate",
      widthIn: String(quote.widthIn),
      heightIn: String(quote.heightIn),
      areaLabel: quote.areaLabel,
      rateLabel: quote.rateLabel,
    },
  };

  const options = signShippingOptions(store);
  if (options.length) params.shipping_options = options;

  if (store.settings.taxEnabled) {
    params.automatic_tax = { enabled: true };
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
