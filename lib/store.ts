import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultMetalSigns, seedStore } from "./seed";
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
  GalleryPhoto,
  GallerySection,
  ShippingOption,
  MetalSignsConfig,
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
  TrafficSources,
} from "./types";

/** Where the store file used to live, before the name was made unguessable. */
const LEGACY_BLOB_PATH = "bhcw/store.json";
const LOCAL_PATH = path.join(process.cwd(), "data", "store.json");

/**
 * This SDK can only write to a PUBLIC Blob store, so whatever we put there is
 * readable by anyone who knows the URL â€” and the store file holds quotes and
 * orders, meaning customer names, emails, phones and shipping addresses.
 *
 * A fixed "bhcw/store.json" sits at a completely predictable URL next to the
 * product photos, so anyone with a photo link could try for it. Deriving the
 * filename from the master session secret gives it 128 bits of entropy.
 *
 * This is obscurity, not access control: the URL should be treated as a
 * credential. Encrypting the customer records would be the real fix.
 */
function blobPath(): string {
  const secret = cleanStr(process.env.MASTER_SESSION_SECRET);
  if (!secret) return LEGACY_BLOB_PATH;
  const tag = createHash("sha256").update("bhcw-store:" + secret).digest("hex").slice(0, 32);
  return "bhcw/store-" + tag + ".json";
}

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
  const kind: ProductKind =
    src.kind === "digital" ? "digital" : src.kind === "sign" ? "sign" : "physical";
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
    stripeTaxBehavior: cleanStr(src.stripeTaxBehavior),
    shippingCents: asCents(src.shippingCents, 0),
    priceLabel: cleanStr(src.priceLabel),
    externalUrl: safeUrl(src.externalUrl),
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
    shippingLabel: cleanStr(src.shippingLabel),
    shippingCents: asCents(src.shippingCents, 0),
    taxCents: asCents(src.taxCents, 0),
    trackingCarrier: cleanStr(src.trackingCarrier),
    trackingNumber: cleanStr(src.trackingNumber),
    shippedAt: cleanStr(src.shippedAt),
    customerNotified: Boolean(src.customerNotified),
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

function normalizeShippingOption(raw: unknown, i: number): ShippingOption | null {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<ShippingOption>;
  const label = cleanStr(src.label);
  if (!label) return null;
  return {
    id: cleanStr(src.id, newId("ship")),
    label,
    amountCents: asCents(src.amountCents, 0),
    minDays: Math.max(0, Math.min(asInt(src.minDays, 0), 90)),
    maxDays: Math.max(0, Math.min(asInt(src.maxDays, 0), 90)),
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
    shippingOptions: normalizeShippingOptions(src),
    perItemShippingLabel: cleanStr(src.perItemShippingLabel, base.perItemShippingLabel),
    pickupEnabled: src.pickupEnabled !== false,
    pickupLabel: cleanStr(src.pickupLabel, base.pickupLabel),
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

/**
 * Stripe caps a Checkout Session at 5 shipping options. Stores written before
 * this existed carried a single flat shippingCents, so migrate that into one
 * named option rather than silently dropping the rate.
 */
function normalizeShippingOptions(src: Partial<SiteCopy>): ShippingOption[] {
  const listed = asArray<unknown>(src.shippingOptions)
    .map(normalizeShippingOption)
    .filter((o): o is ShippingOption => Boolean(o))
    .slice(0, 5);
  if (listed.length) return listed;
  const legacy = asCents(src.shippingCents, 0);
  if (legacy > 0) {
    return [{ id: newId("ship"), label: "Standard shipping", amountCents: legacy, minDays: 0, maxDays: 0 }];
  }
  // Same fallback rule the categories use: an empty list means "never
  // configured", and shipping free by accident is worse than the default.
  return seedStore().site.shippingOptions;
}

function normalizeSources(raw: unknown): TrafficSources {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<TrafficSources>;
  return {
    facebook: Math.max(0, asInt(src.facebook, 0)),
    instagram: Math.max(0, asInt(src.instagram, 0)),
    google: Math.max(0, asInt(src.google, 0)),
    direct: Math.max(0, asInt(src.direct, 0)),
    other: Math.max(0, asInt(src.other, 0)),
  };
}

function normalizeStats(raw: unknown): ShopStats {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<ShopStats>;
  const days = asArray<unknown>(src.days)
    .map((row) => {
      const d = (row && typeof row === "object" ? row : {}) as { date?: unknown; pageViews?: unknown; uniqueVisitors?: unknown };
      const date = cleanStr(d.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return {
        date,
        pageViews: Math.max(0, asInt(d.pageViews, 0)),
        uniqueVisitors: Math.max(0, asInt(d.uniqueVisitors, 0)),
      };
    })
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-90);
  return {
    pageViews: Math.max(0, asInt(src.pageViews, 0)),
    uniqueVisitors: Math.max(0, asInt(src.uniqueVisitors, 0)),
    days,
    sources: normalizeSources(src.sources),
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
    taxEnabled: src.taxEnabled === true,
    shippingCombine: src.shippingCombine === "sum" ? "sum" : "highest",
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


function normalizeGalleryPhoto(raw: unknown, i: number): GalleryPhoto | null {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<GalleryPhoto>;
  const url = safeUrl(src.src);
  if (!url) return null;
  const caption = cleanStr(src.caption);
  return {
    id: cleanStr(src.id, newId("photo")),
    src: url,
    caption,
    alt: cleanStr(src.alt, caption || `Gallery photo ${i + 1}`),
    simulated: src.simulated === true,
  };
}

function normalizeGallerySection(raw: unknown, i: number): GallerySection | null {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<GallerySection>;
  const title = cleanStr(src.title);
  if (!title) return null;
  const photos = asArray<unknown>(src.photos)
    .map(normalizeGalleryPhoto)
    .filter((p): p is GalleryPhoto => Boolean(p))
    .slice(0, 48);
  return {
    id: cleanStr(src.id, newId("gal")),
    title,
    subtitle: cleanStr(src.subtitle),
    visible: src.visible !== false,
    sortOrder: asInt(src.sortOrder, i + 1),
    photos,
  };
}


/**
 * Live Blob previously held an incomplete sample gallery (odd slots only) with
 * captions for small decorative signs but old storefront/ranch JPEGs. Seed alone
 * cannot win while any gallery array exists in Blob — so heal the known sample
 * section back to the full 10-slot default without wiping real custom sections.
 */
function healSampleGallery(sections: GallerySection[]): GallerySection[] {
  const seed = seedStore().gallery;
  const seedCnc = seed.find((s) => s.id === "gal_cnc_signs") || seed[0];
  const seedMetal = seed.find((s) => s.id === "gal_custom_metal");
  const need = new Set(
    Array.from({ length: 10 }, (_, i) => `/gallery/cnc-sign-${String(i + 1).padStart(2, "0")}.jpg`),
  );

  let changed = false;
  const out = sections.map((section) => {
    const srcs = section.photos.map((p) => p.src);
    const allSamplePaths = srcs.length > 0 && srcs.every((s) => /^\/gallery\/cnc-sign-\d{2}\.jpg$/.test(s));
    const isCncSample =
      section.id === "gal_cnc_signs" ||
      (/plasma-cut signs/i.test(section.title) && (allSamplePaths || section.photos.every((p) => p.simulated)));
    if (!isCncSample || !seedCnc) return section;
    const have = new Set(srcs);
    const incomplete = [...need].some((s) => !have.has(s)) || section.photos.length < 10;
    if (!incomplete) return section;
    changed = true;
    return {
      ...seedCnc,
      id: section.id || seedCnc.id,
      visible: section.visible,
      sortOrder: section.sortOrder,
    };
  });

  if (seedMetal && !out.some((s) => s.id === "gal_custom_metal" || /custom metal signs/i.test(s.title))) {
    out.push({ ...seedMetal, sortOrder: out.length + 1 });
    changed = true;
  }

  return changed ? out.map((s, i) => ({ ...s, sortOrder: i + 1 })) : sections;
}

function normalizeGallery(raw: unknown): GallerySection[] {
  const listed = asArray<unknown>(raw)
    .map(normalizeGallerySection)
    .filter((s): s is GallerySection => Boolean(s))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s, i) => ({ ...s, sortOrder: i + 1 }));
  return listed.length ? listed : seedStore().gallery;
}

function clampInch(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0.25, Math.min(240, Math.round(n * 100) / 100));
}

function normalizeMetalSigns(raw: unknown): MetalSignsConfig {
  const base = defaultMetalSigns();
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<MetalSignsConfig>;
  const media = asArray<unknown>(src.media)
    .map((m) => safeUrl(m))
    .filter(Boolean);
  return {
    visible: src.visible !== false,
    heading: cleanStr(src.heading, base.heading),
    lede: cleanMultiline(src.lede, base.lede),
    note: cleanMultiline(src.note, base.note),
    unit: src.unit === "sqin" ? "sqin" : "sqft",
    rateCents: asCents(src.rateCents, 0),
    minCents: asCents(src.minCents, 0),
    minWidthIn: clampInch(src.minWidthIn, base.minWidthIn),
    minHeightIn: clampInch(src.minHeightIn, base.minHeightIn),
    maxWidthIn: clampInch(src.maxWidthIn, base.maxWidthIn),
    maxHeightIn: clampInch(src.maxHeightIn, base.maxHeightIn),
    shippingCents: asCents(src.shippingCents, 0),
    shippingBaseCents: asCents(src.shippingBaseCents, 0),
    shippingPerSqFtCents: asCents(src.shippingPerSqFtCents, 0),
    shippingMaxCents: asCents(src.shippingMaxCents, 0),
    media: media.length ? media : base.media,
  };
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
    gallery: normalizeGallery(src.gallery),
    metalSigns: normalizeMetalSigns(src.metalSigns),
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
    // Current name first, then the old predictable one, so a store written
    // before this change still loads and gets migrated on the next save.
    const candidates = [blobPath(), LEGACY_BLOB_PATH];
    for (const pathname of candidates) {
      const listed = await list({ prefix: pathname });
      const hit = listed.blobs.find((b) => b.pathname === pathname);
      if (!hit?.url) continue;
      const res = await fetch(hit.url, { cache: "no-store" });
      if (!res.ok) continue;
      return normalizeStore(await res.json());
    }
    return null;
  } catch {
    return null;
  }
}

async function writeBlob(store: ShopStore): Promise<{ ok: boolean; error: string }> {
  if (!blobConfigured()) return { ok: false, error: "BLOB_READ_WRITE_TOKEN is not set." };
  try {
    const { put } = await import("@vercel/blob");
    const safe = {
      ...store,
      settings: { ...store.settings, stripeSecretKey: "" },
    };
    const pathname = blobPath();
    await put(pathname, JSON.stringify(safe), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    // Once the data is safely at the unguessable name, remove the old copy so
    // customer records stop sitting at a URL anyone could guess.
    // Attempted on every save rather than once per process: a once-only flag
    // silently skips the cleanup if the legacy file shows up later, and admin
    // saves are rare enough that the extra call costs nothing.
    if (pathname !== LEGACY_BLOB_PATH) {
      try {
        const { del } = await import("@vercel/blob");
        await del(LEGACY_BLOB_PATH);
      } catch {
        /* it usually just does not exist */
      }
    }
    return { ok: true, error: "" };
  } catch (err) {
    // Swallowing this made a broken Blob store look identical to a missing
    // one. The reason matters: bad token, wrong store, rejected option.
    const error = err instanceof Error ? err.message : "Blob write failed.";
    console.error("blob write failed:", error);
    return { ok: false, error };
  }
}

/**
 * Read-only probe so Master Control can say whether the token actually works,
 * rather than only reporting whether it exists.
 */
export async function blobDiagnostics(): Promise<{
  tokenPresent: boolean;
  readOk: boolean;
  found: boolean;
  error: string;
}> {
  const tokenPresent = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (!tokenPresent) {
    return { tokenPresent, readOk: false, found: false, error: "BLOB_READ_WRITE_TOKEN is not set." };
  }
  try {
    const { list } = await import("@vercel/blob");
    const pathname = blobPath();
    const listed = await list({ prefix: pathname });
    return {
      tokenPresent,
      readOk: true,
      found: listed.blobs.some((b) => b.pathname === pathname),
      error: "",
    };
  } catch (err) {
    return {
      tokenPresent,
      readOk: false,
      found: false,
      error: err instanceof Error ? err.message : "Blob list failed.",
    };
  }
}

export async function readStore(): Promise<ShopStore> {
  const cached = g.__bhcwCache;
  if (cached && Date.now() - cached.at < 4000) return cached.data;

  const fromBlob = await readBlob();
  const fromLocal = fromBlob ? null : await readLocal();
  const data = fromBlob || fromLocal || seedStore();
  const healedGallery = healSampleGallery(data.gallery || []);
  const needsHeal =
    JSON.stringify(healedGallery) !== JSON.stringify(data.gallery || []);
  const finalStore = needsHeal ? { ...data, gallery: healedGallery } : data;
  g.__bhcwCache = { data: finalStore, at: Date.now() };
  if (needsHeal && blobConfigured()) {
    // Fire-and-forget durable repair so the next cold start already has 10 samples.
    void writeStore(finalStore);
  }
  return finalStore;
}

export async function writeStore(
  next: ShopStore,
): Promise<{ ok: boolean; persisted: string; error: string }> {
  const store = normalizeStore({ ...next, updatedAt: new Date().toISOString() });
  g.__bhcwCache = { data: store, at: Date.now() };

  const blob = await writeBlob(store);
  if (blob.ok) return { ok: true, persisted: "blob", error: "" };

  try {
    await writeLocal(store);
    // On Vercel this file is ephemeral. Report it as a failure so callers
    // surface it, rather than pretending the write stuck.
    if (process.env.VERCEL) {
      console.error("store write is NOT durable:", blob.error);
      return { ok: false, persisted: "ephemeral", error: blob.error };
    }
    return { ok: true, persisted: "file", error: "" };
  } catch {
    return { ok: false, persisted: "memory", error: blob.error };
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
    gallery: store.gallery,
    metalSigns: store.metalSigns,
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
    return "NOT DURABLE â€” set BLOB_READ_WRITE_TOKEN (connect a Vercel Blob store) or orders and edits are lost";
  return "Local data/store.json";
}
