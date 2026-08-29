import type { Product, ShopStore } from "./types";
import { stripeClient, siteUrl } from "./stripe";
import { cleanStr, safeUrl } from "./sanitize";

function httpsImages(product: Product): string[] {
  const origin = siteUrl();
  return (product.photos.length ? product.photos : product.media)
    .map((url) => {
      const clean = safeUrl(url);
      if (!clean) return "";
      if (clean.startsWith("/")) return `${origin}${clean}`;
      return clean;
    })
    .filter((url) => url.startsWith("https://"))
    .slice(0, 8);
}

async function upsertOne(store: ShopStore, product: Product): Promise<Product> {
  const stripe = stripeClient(store);
  if (!stripe || !product.name || product.priceCents <= 0) return product;

  const images = httpsImages(product);
  const description = cleanStr(product.description).slice(0, 400) || undefined;
  let productId = product.stripeProductId;

  if (productId) {
    try {
      await stripe.products.update(productId, {
        name: product.name,
        description,
        images,
        active: product.visible,
        metadata: { shop_id: product.id, slug: product.slug },
      });
    } catch {
      productId = "";
    }
  }

  if (!productId) {
    const created = await stripe.products.create({
      name: product.name,
      description,
      images,
      active: product.visible,
      metadata: { shop_id: product.id, slug: product.slug },
    });
    productId = created.id;
  }

  let priceId = product.stripePriceId;
  if (!priceId || product.stripePriceCents !== product.priceCents) {
    if (priceId) {
      await stripe.prices.update(priceId, { active: false }).catch(() => undefined);
    }
    const price = await stripe.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: product.priceCents,
      nickname: product.name,
      lookup_key: `bhcw_${product.id}_${product.priceCents}`,
      transfer_lookup_key: true,
      metadata: { shop_id: product.id },
    });
    priceId = price.id;
  }

  return {
    ...product,
    stripeProductId: productId,
    stripePriceId: priceId,
    stripePriceCents: product.priceCents,
  };
}

export async function syncCatalogToStripe(store: ShopStore): Promise<{
  store: ShopStore;
  synced: number;
  error: string;
}> {
  if (!stripeClient(store)) {
    return { store, synced: 0, error: "Stripe is not configured." };
  }
  const products: Product[] = [];
  let synced = 0;
  let error = "";
  for (const product of store.products) {
    try {
      const next = await upsertOne(store, product);
      if (next.stripeProductId && next.stripeProductId !== product.stripeProductId) synced += 1;
      else if (next.stripePriceId !== product.stripePriceId) synced += 1;
      else if (next.stripeProductId) synced += 1;
      products.push(next);
    } catch (err) {
      products.push(product);
      error = err instanceof Error ? err.message : "Stripe catalog sync failed.";
    }
  }
  return { store: { ...store, products }, synced, error };
}
