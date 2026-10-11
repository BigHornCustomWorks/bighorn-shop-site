/**
 * Ready-to-cut sign designs.
 *
 * No runtime imports: the unit test loads this file directly in Node.
 * Prices live on the saved size. Nothing in here reads a price off a request.
 */
import type { SignDesign, SignDesignSize } from "./types";

/** Cart product id prefix. Not a catalog product id. */
export const SIGN_DESIGN_CART_PREFIX = "signdesign:";
/** Order metadata slug prefix. Not a catalog slug. */
export const SIGN_DESIGN_SLUG_PREFIX = "sign-design-";
/** Stripe Checkout rejects a charge under $0.50. A blank price stays off the shop. */
export const MIN_DESIGN_PRICE_CENTS = 50;

const MAX_DESIGNS = 40;
const MAX_SIZES = 8;
const MAX_SIDE_IN = 108;

function text(value: unknown, max = 80): string {
  if (value == null) return "";
  return String(value)
    .replace(/<\/?[^>]+>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function cents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(Math.round(n), 10_000_000));
}

function inch(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_SIDE_IN, Math.round(n * 100) / 100);
}

function imageUrl(value: unknown): string {
  const raw = text(value, 2000);
  if (!raw || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(raw)) return "";
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) {
    return raw.split("?")[0] || "";
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function idPart(value: unknown, fallback: string): string {
  const cleaned = text(value, 40).replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned || fallback;
}

export function designCartId(designId: string, sizeId: string): string {
  return `${SIGN_DESIGN_CART_PREFIX}${designId}:${sizeId}`;
}

export function designSlug(designId: string): string {
  return `${SIGN_DESIGN_SLUG_PREFIX}${designId}`;
}

/** Inbox label when every line in the order is a ready-to-cut design. */
export function signDesignOrderKind(slugs: string[]): string {
  const keys = slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean);
  if (keys.length && keys.every((key) => key.startsWith(SIGN_DESIGN_SLUG_PREFIX))) return "sign-design";
  return "";
}

export function parseDesignCart(productId: string): { designId: string; sizeId: string } | null {
  const raw = text(productId, 120);
  if (!raw.startsWith(SIGN_DESIGN_CART_PREFIX)) return null;
  const rest = raw.slice(SIGN_DESIGN_CART_PREFIX.length);
  const cut = rest.indexOf(":");
  if (cut <= 0 || cut >= rest.length - 1) return null;
  const designId = rest.slice(0, cut).trim();
  const sizeId = rest.slice(cut + 1).trim();
  if (!designId || !sizeId || sizeId.includes(":")) return null;
  return { designId, sizeId };
}

export function sizeLabel(size: Pick<SignDesignSize, "label" | "widthIn" | "heightIn">): string {
  const typed = size.label.trim();
  if (typed) return typed;
  const n = (v: number) => {
    const rounded = Math.round(v * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  };
  return `${n(size.widthIn)} × ${n(size.heightIn)} in`;
}

/** Sizes a customer can order. A missing or tiny price is not a free sign. */
export function saleSizes(design: SignDesign): SignDesignSize[] {
  return (design.sizes || []).filter(
    (size) => size.priceCents >= MIN_DESIGN_PRICE_CENTS && size.widthIn > 0 && size.heightIn > 0,
  );
}

export function designsForSale(designs: SignDesign[] | undefined): SignDesign[] {
  return (designs || []).filter((design) => design.name.trim() && design.image && saleSizes(design).length > 0);
}

/**
 * The stored size for this pair of ids. Returns null unless that size is actually for sale.
 * There is no price argument: the caller cannot supply one.
 */
export function lookupDesignSize(
  designs: SignDesign[] | undefined,
  designId: string,
  sizeId: string,
): { design: SignDesign; size: SignDesignSize } | null {
  const design = (designs || []).find((item) => item.id === designId);
  if (!design || !design.name.trim() || !design.image) return null;
  const size = saleSizes(design).find((item) => item.id === sizeId);
  if (!size) return null;
  return { design, size };
}

export function normalizeSignDesigns(raw: unknown): SignDesign[] {
  if (!Array.isArray(raw)) return [];
  const used = new Set<string>();
  const designs: SignDesign[] = [];
  for (let i = 0; i < raw.length && designs.length < MAX_DESIGNS; i += 1) {
    const src = raw[i] && typeof raw[i] === "object" ? (raw[i] as Record<string, unknown>) : null;
    if (!src) continue;
    const name = text(src.name, 80);
    const image = imageUrl(src.image);
    if (!name && !image) continue;
    const baseId = idPart(src.id, `design_${i + 1}`);
    let id = baseId;
    let n = 2;
    while (used.has(id)) {
      id = `${baseId.slice(0, 32)}_${n}`;
      n += 1;
    }
    used.add(id);
    const sizeUsed = new Set<string>();
    const sizes: SignDesignSize[] = [];
    const listed = Array.isArray(src.sizes) ? src.sizes : [];
    for (let s = 0; s < listed.length && sizes.length < MAX_SIZES; s += 1) {
      const row = listed[s] && typeof listed[s] === "object" ? (listed[s] as Record<string, unknown>) : null;
      if (!row) continue;
      const label = text(row.label, 60);
      const widthIn = inch(row.widthIn);
      const heightIn = inch(row.heightIn);
      const priceCents = cents(row.priceCents);
      if (!label && widthIn <= 0 && heightIn <= 0 && priceCents <= 0) continue;
      const baseSize = idPart(row.id, `size_${s + 1}`);
      let sizeId = baseSize;
      let n = 2;
      while (sizeUsed.has(sizeId)) {
        sizeId = `${baseSize.slice(0, 32)}_${n}`;
        n += 1;
      }
      sizeUsed.add(sizeId);
      sizes.push({ id: sizeId, label, widthIn, heightIn, priceCents });
    }
    designs.push({
      id,
      name,
      image,
      sizes: sizes.length ? sizes : [{ id: "size_1", label: "", widthIn: 0, heightIn: 0, priceCents: 0 }],
    });
  }
  return designs;
}
