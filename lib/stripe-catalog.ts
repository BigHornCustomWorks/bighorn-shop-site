import type { Product, ShopStore } from "./types";
import { stripeClient, siteUrl } from "./stripe";
import { stripeKeyMode } from "./store";
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
  let priceId = product.stripePriceId;

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
    // The old product id was unusable, so its price id is dead too — never
    // carry it onto the replacement product.
    priceId = "";
  }

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

  // Stripe catalog ids are per-mode: a test price is invisible to a live key
  // and checkout dies with "No such price". If the key mode changed since the
  // last sync, drop the cached ids so everything is recreated in the new mode.
  const mode = stripeKeyMode(store);
  const lastMode = store.settings.catalogMode || store.settings.stripeMode;
  const stale = Boolean(mode && lastMode && lastMode !== mode);
  const source = stale
    ? store.products.map((p) => ({
        ...p,
        stripeProductId: "",
        stripePriceId: "",
        stripePriceCents: 0,
      }))
    : store.products;

  const products: Product[] = [];
  let synced = 0;
  let error = "";
  for (const product of source) {
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
  return {
    store: {
      ...store,
      products,
      settings: { ...store.settings, catalogMode: mode || store.settings.catalogMode },
    },
    synced,
    error,
  };
}
