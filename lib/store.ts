import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { seedStore } from "./seed";
import {
  asArray,
  asCents,
  asInt,
  cleanMultiline,
  cleanStr,
  newId,
  safeSlug,
  safeUrl,
} from "./sanitize";
import { splitMedia } from "./video";
import type {
  FooterLink,
  Product,
  ProductKind,
  ProductVariant,
  Quote,
  ShopCategory,
  ShopOrder,
  ShopSettings,
  ShopStats,
  ShopStore,
  SiteCopy,
} from "./types";

const BLOB_PATH = "bhcw/store.json";
const LOCAL_PATH = path.join(process.cwd(), "data", "store.json");

type Cache = { data: ShopStore; at: number };
const g = globalThis as typeof globalThis & { __bhcwCache?: Cache };

/**
 * Vercel Blob needs a real token. Being on Vercel is not enough: without the
 * token every put() fails and the write falls through to the ephemeral
 * serverless filesystem, which drops orders on the next cold start.
 */
function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function storageIsDurable(): boolean {
  return blobConfigured() || !process.env.VERCEL;
}

function normalizeVariant(raw: unknown, i: number): ProductVariant {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<ProductVariant>;
  return {
    id: safeSlug(src.id, `v${i + 1}`),
    name: cleanStr(src.name, `Option ${i + 1}`),
  };
}

function normalizeProduct(raw: unknown, i: number): Product | null {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<Product>;
  const name = cleanStr(src.name);
  if (!name) return null;
  const photosIn = asArray<unknown>(src.photos).map((p) => safeUrl(p)).filter(Boolean);
  const videosIn = asArray<unknown>(src.videos).map((v) => safeUrl(v)).filter(Boolean);
  const mediaIn = asArray<unknown>(src.media).map((m) => safeUrl(m)).filter(Boolean);
  const { media, photos, videos } = splitMedia(mediaIn.length ? mediaIn : [...photosIn, ...videosIn]);
  const kind: ProductKind = src.kind === "digital" ? "digital" : "physical";
  return {
    id: cleanStr(src.id, newId("prod")),
    slug: safeSlug(src.slug, safeSlug(name, `part-${i + 1}`)),
    name,
    priceCents: asCents(src.priceCents, 0),
    description: cleanMultiline(src.description),
    media,
    photos,
    videos,
    category: cleanStr(src.category, "Mill accessories"),
    kind,
    digitalNote: cleanMultiline(
      src.digitalNote,
      kind === "digital"
        ? "Digital item. After Stripe payment, Clint emails the file or download link. No shipping."
        : "",
    ),
    variants: asArray<unknown>(src.variants).map(normalizeVariant).slice(0, 24),
    variantNote: cleanMultiline(src.variantNote),
    visible: src.visible !== false,
    sortOrder: asInt(src.sortOrder, i + 1),
    stripeProductId: cleanStr(src.stripeProductId),
    stripePriceId: cleanStr(src.stripePriceId),
    stripePriceCents: asCents(src.stripePriceCents, 0),
  };
}

function normalizeOrder(raw: unknown): ShopOrder | null {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<ShopOrder>;
  const sessionId = cleanStr(src.sessionId);
  const email = cleanStr(src.email);
  if (!sessionId && !email && !cleanStr(src.items)) return null;
  return {
    id: cleanStr(src.id, newId("order")),
    createdAt: cleanStr(src.createdAt, new Date().toISOString()),
    email,
    name: cleanStr(src.name),
    amountCents: asCents(src.amountCents, 0),
    items: cleanMultiline(src.items),
    address: cleanMultiline(src.address),
    sessionId,
    emailed: Boolean(src.emailed),
    read: Boolean(src.read),
  };
}

function normalizeQuote(raw: unknown): Quote | null {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<Quote>;
  const email = cleanStr(src.email);
  const name = cleanStr(src.name);
  if (!email && !name) return null;
  return {
    id: cleanStr(src.id, newId("quote")),
    name,
    email,
    phone: cleanStr(src.phone),
    need: cleanMultiline(src.need),
    photoUrl: safeUrl(src.photoUrl),
    createdAt: cleanStr(src.createdAt, new Date().toISOString()),
    read: Boolean(src.read),
    emailed: Boolean(src.emailed),
  };
}

function normalizeLink(raw: unknown, i: number): FooterLink {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<FooterLink>;
  return {
    id: cleanStr(src.id, `link${i + 1}`),
    label: cleanStr(src.label, "Link"),
    url: safeUrl(src.url),
  };
}

function normalizeSite(raw: unknown): SiteCopy {
  const base = seedStore().site;
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<SiteCopy>;
  const links = asArray<unknown>(src.footerLinks).map(normalizeLink).filter((l) => l.url);
  return {
    companyName: cleanStr(src.companyName, base.companyName),
    legalName: cleanStr(src.legalName, base.legalName),
    taglineLine1: cleanStr(src.taglineLine1, base.taglineLine1),
    taglineLine2: cleanStr(src.taglineLine2, base.taglineLine2),
    taglineLine3: cleanStr(src.taglineLine3, base.taglineLine3),
    whoWeAre: cleanMultiline(src.whoWeAre, base.whoWeAre),
    whatWeMake: cleanMultiline(src.whatWeMake, base.whatWeMake),
    aboutBody: cleanMultiline(src.aboutBody, base.aboutBody),
    contactEmail: cleanStr(src.contactEmail, base.contactEmail),
    linkedinUrl: safeUrl(src.linkedinUrl) || base.linkedinUrl,
    location: cleanStr(src.location, base.location),
    shippingNote: cleanMultiline(src.shippingNote, base.shippingNote),
    shippingCents: asCents(src.shippingCents, 0),
    repairStatusLabel: cleanStr(src.repairStatusLabel, base.repairStatusLabel),
    repairStatusLine: cleanMultiline(src.repairStatusLine, base.repairStatusLine),
    repairStatusUrl: safeUrl(src.repairStatusUrl) || base.repairStatusUrl,
    logoUrl: safeUrl(src.logoUrl) || base.logoUrl,
    heroUrl: safeUrl(src.heroUrl) || base.heroUrl,
    heroVideoUrl: safeUrl(src.heroVideoUrl),
    footerNote: cleanStr(src.footerNote, base.footerNote),
    footerLinks: links.length ? links : base.footerLinks,
    shopFloorNotes: cleanMultiline(src.shopFloorNotes, base.shopFloorNotes),
  };
}

function normalizeStats(raw: unknown): ShopStats {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<ShopStats>;
  return {
    pageViews: Math.max(0, asInt(src.pageViews, 0)),
    uniqueVisitors: Math.max(0, asInt(src.uniqueVisitors, 0)),
  };
}

function normalizeSettings(raw: unknown): ShopSettings {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<ShopSettings>;
  const key = cleanStr(src.stripeSecretKey);
  const looksLikeKey = /^(sk|rk)_/.test(key);
  const catalogMode = src.catalogMode === "live" ? "live" : src.catalogMode === "test" ? "test" : "";
  return {
    stripeSecretKey: looksLikeKey ? key : "",
    stripeMode: src.stripeMode === "live" ? "live" : "test",
    catalogMode,
  };
}

function normalizeCategory(raw: unknown, i: number): ShopCategory | null {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<ShopCategory>;
  const name = cleanStr(src.name);
  if (!name) return null;
  return {
    id: cleanStr(src.id, newId("cat")),
    name,
    sortOrder: asInt(src.sortOrder, i + 1),
  };
}

function mergeCategories(raw: unknown, products: Product[]): ShopCategory[] {
  const listed = asArray<unknown>(raw)
    .map(normalizeCategory)
    .filter((c): c is ShopCategory => Boolean(c));
  const byName = new Map(listed.map((c) => [c.name.toLowerCase(), c]));
  for (const p of products) {
    const label = p.category || "Mill accessories";
    if (!byName.has(label.toLowerCase())) {
      const extra: ShopCategory = {
        id: newId("cat"),
        name: label,
        sortOrder: byName.size + 1,
      };
      byName.set(label.toLowerCase(), extra);
    }
  }
  const merged = [...byName.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  return merged.length ? merged.map((c, i) => ({ ...c, sortOrder: i + 1 })) : seedStore().categories;
}

export function normalizeStore(raw: unknown): ShopStore {
  const base = seedStore();
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<ShopStore>;
  const products = asArray<unknown>(src.products)
    .map(normalizeProduct)
    .filter((p): p is Product => Boolean(p))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const finalProducts = products.length ? products : base.products;
  return {
    products: finalProducts,
    categories: mergeCategories(src.categories, finalProducts),
    quotes: asArray<unknown>(src.quotes)
      .map(normalizeQuote)
      .filter((q): q is Quote => Boolean(q))
      .slice(0, 400),
    orders: asArray<unknown>(src.orders)
      .map(normalizeOrder)
      .filter((o): o is ShopOrder => Boolean(o))
      .slice(0, 400),
    site: normalizeSite(src.site),
    settings: normalizeSettings(src.settings),
    stats: normalizeStats(src.stats),
    updatedAt: cleanStr(src.updatedAt),
  };
}

async function readLocal(): Promise<ShopStore | null> {
  try {
    const text = await readFile(LOCAL_PATH, "utf8");
    return normalizeStore(JSON.parse(text));
  } catch {
    return null;
  }
}

async function writeLocal(store: ShopStore): Promise<void> {
  await mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await writeFile(LOCAL_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function readBlob(): Promise<ShopStore | null> {
  if (!blobConfigured()) return null;
  try {
    const { list } = await import("@vercel/blob");
    const listed = await list({ prefix: BLOB_PATH });
    const hit = listed.blobs.find((b) => b.pathname === BLOB_PATH);
    if (!hit?.url) return null;
    const res = await fetch(hit.url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return normalizeStore(json);
  } catch {
    return null;
  }
}

async function writeBlob(store: ShopStore): Promise<boolean> {
  if (!blobConfigured()) return false;
  try {
    const { put } = await import("@vercel/blob");
    const safe = {
      ...store,
      settings: { ...store.settings, stripeSecretKey: "" },
    };
    await put(BLOB_PATH, JSON.stringify(safe), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return true;
  } catch {
    return false;
  }
}

export async function readStore(): Promise<ShopStore> {
  const cached = g.__bhcwCache;
  if (cached && Date.now() - cached.at < 4000) return cached.data;

  const fromBlob = await readBlob();
  const fromLocal = fromBlob ? null : await readLocal();
  const data = fromBlob || fromLocal || seedStore();
  g.__bhcwCache = { data, at: Date.now() };
  return data;
}

export async function writeStore(next: ShopStore): Promise<{ ok: boolean; persisted: string }> {
  const store = normalizeStore({ ...next, updatedAt: new Date().toISOString() });
  g.__bhcwCache = { data: store, at: Date.now() };

  const blobOk = await writeBlob(store);
  if (blobOk) return { ok: true, persisted: "blob" };

  try {
    await writeLocal(store);
    // On Vercel this file is ephemeral. Report it as a failure so callers
    // surface it, rather than pretending the write stuck.
    if (process.env.VERCEL) {
      console.error(
        "store write is NOT durable: BLOB_READ_WRITE_TOKEN missing — connect a Vercel Blob store",
      );
      return { ok: false, persisted: "ephemeral" };
    }
    return { ok: true, persisted: "file" };
  } catch {
    return { ok: false, persisted: "memory" };
  }
}

export function visibleProducts(store: ShopStore): Product[] {
  return store.products.filter((p) => p.visible);
}

export function categorySlug(name: string): string {
  return safeSlug(name, "all");
}

export function productCategories(products: Product[]): string[] {
  const seen = new Map<string, string>();
  for (const p of products) {
    const label = p.category || "Other";
    const key = categorySlug(label);
    if (!seen.has(key)) seen.set(key, label);
  }
  return [...seen.values()];
}

export function shopFilterCategories(store: ShopStore): ShopCategory[] {
  const visible = visibleProducts(store);
  return (store.categories || []).filter((c) =>
    visible.some((p) => p.category.toLowerCase() === c.name.toLowerCase()),
  );
}

export function productBySlug(store: ShopStore, slug: string): Product | undefined {
  const want = safeSlug(slug);
  return visibleProducts(store).find((p) => p.slug === want);
}

export function publicStore(store: ShopStore): Omit<ShopStore, "settings" | "quotes" | "orders"> & {
  settings: { stripeMode: "test" | "live"; stripeConfigured: boolean };
  quoteCount: number;
  orderCount: number;
} {
  return {
    products: store.products,
    categories: store.categories,
    site: store.site,
    stats: store.stats,
    updatedAt: store.updatedAt,
    quoteCount: store.quotes.length,
    orderCount: store.orders.length,
    settings: {
      stripeMode: store.settings.stripeMode,
      stripeConfigured: Boolean(stripeSecret(store)),
    },
  };
}

export function stripeSecret(store: ShopStore): string {
  return cleanStr(store.settings.stripeSecretKey) || cleanStr(process.env.STRIPE_SECRET_KEY);
}

/**
 * The mode of the key actually in use, read from its prefix. This is the real
 * answer; settings.stripeMode is only a label someone picked in the UI.
 */
export function stripeKeyMode(store: ShopStore): "test" | "live" | "" {
  const key = stripeSecret(store);
  if (/^(sk|rk)_live_/.test(key)) return "live";
  if (/^(sk|rk)_test_/.test(key)) return "test";
  return "";
}

export function persistenceLabel(): string {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "Vercel Blob (durable)";
  if (process.env.VERCEL)
    return "NOT DURABLE — set BLOB_READ_WRITE_TOKEN (connect a Vercel Blob store) or orders and edits are lost";
  return "Local data/store.json";
}
