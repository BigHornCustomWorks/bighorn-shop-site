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
  if (!stripe || !product.name || product.priceCents <= 0 || product.externalUrl) return product;

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

  // tax_behavior is write-once on a Stripe price. A price created without it
  // makes Stripe Tax reject the whole session, so recreate any price missing it.
  const taxReady = product.stripeTaxBehavior === "exclusive";
  if (!priceId || product.stripePriceCents !== product.priceCents || !taxReady) {
    if (priceId) {
      await stripe.prices.update(priceId, { active: false }).catch(() => undefined);
    }
    const price = await stripe.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: product.priceCents,
      tax_behavior: "exclusive",
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
    stripeTaxBehavior: "exclusive",
  };
}

/**
 * Whether this product still matches what Stripe already has. Re-pushing an
 * unchanged product costs two API round-trips for nothing, and with a dozen
 * products that turns every save into a multi-second wait.
 */
function needsSync(previous: Product | undefined, product: Product): boolean {
  if (!product.stripeProductId || !product.stripePriceId) return true;
  if (product.stripeTaxBehavior !== "exclusive") return true;
  if (product.stripePriceCents !== product.priceCents) return true;
  if (!previous) return true;
  return (
    previous.name !== product.name ||
    previous.description !== product.description ||
    previous.visible !== product.visible ||
    previous.priceCents !== product.priceCents ||
    previous.photos.join("|") !== product.photos.join("|") ||
    previous.media.join("|") !== product.media.join("|")
  );
}

export async function syncCatalogToStripe(
  store: ShopStore,
  previous?: ShopStore,
): Promise<{
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
        stripeTaxBehavior: "",
      }))
    : store.products;

  const before = new Map((previous?.products || []).map((p) => [p.id, p]));
  const products: Product[] = [];
  let synced = 0;
  let error = "";
  for (const product of source) {
    // A mode switch cleared every id, so everything genuinely has to go up.
    if (!stale && !needsSync(before.get(product.id), product)) {
      products.push(product);
      continue;
    }
    try {
      products.push(await upsertOne(store, product));
      synced += 1;
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
