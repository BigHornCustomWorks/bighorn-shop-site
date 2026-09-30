/** Buyer download links. No locker, tokens, or licenses — just HTTPS files emailed after payment. */

export const MANUAL_DIGITAL_NOTE =
  "Digital item. After payment, Clint emails the file. Nothing ships.";

export const AUTO_DIGITAL_NOTE =
  "After payment, the download links are emailed to the address you use at checkout. Nothing ships.";

const LEGACY_DIGITAL_NOTES = new Set([
  MANUAL_DIGITAL_NOTE,
  AUTO_DIGITAL_NOTE,
  "Digital item. After Stripe payment, Clint emails the file or download link. No shipping.",
]);

export const MAX_FILE_URLS = 8;
const MAX_URL_LENGTH = 2000;

export type DigitalDownload = { name: string; urls: string[] };

export type DigitalProductRef = {
  slug: string;
  name: string;
  kind: string;
  digitalFileUrls?: string[];
};

export function httpsFileUrls(value: unknown, max = MAX_FILE_URLS): string[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\n+/)
      : [];
  const out: string[] = [];
  const cap = Math.max(0, Math.min(max, MAX_FILE_URLS));
  for (const item of list) {
    const raw = String(item ?? "").trim();
    if (!raw || raw.length > MAX_URL_LENGTH) continue;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (url.protocol !== "https:") continue;
    if (url.username || url.password) continue;
    url.hash = "";
    const text = url.toString();
    if (!text || text.length > MAX_URL_LENGTH || out.includes(text)) continue;
    out.push(text);
    if (out.length >= cap) break;
  }
  return out;
}

/** Empty or the old “Clint emails a link” sentence follows whether file links exist. Custom notes stay. */
export function honestDigitalNote(note: string, hasUrls: boolean): string {
  const trimmed = note.trim();
  if (trimmed && !LEGACY_DIGITAL_NOTES.has(trimmed)) return trimmed;
  return hasUrls ? AUTO_DIGITAL_NOTE : MANUAL_DIGITAL_NOTE;
}

export function cleanSlugList(value: unknown, max = 24): string[] {
  const list = Array.isArray(value) ? value : [];
  const out: string[] = [];
  for (const item of list) {
    const slug = String(item ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "")
      .slice(0, 80);
    if (!slug || out.includes(slug)) continue;
    out.push(slug);
    if (out.length >= max) break;
  }
  return out;
}

export function digitalSlugsInCart(slugs: string[], products: { slug: string; kind: string }[]): string[] {
  const out: string[] = [];
  for (const slug of slugs) {
    const product = products.find((p) => p.slug.toLowerCase() === slug.trim().toLowerCase());
    if (product?.kind !== "digital") continue;
    const clean = product.slug.trim().toLowerCase();
    if (!clean || out.includes(clean)) continue;
    out.push(clean);
  }
  return out;
}

export function collectDigitalDownloads(slugs: string[], products: DigitalProductRef[]): DigitalDownload[] {
  const out: DigitalDownload[] = [];
  const seen = new Set<string>();
  for (const slug of slugs) {
    const key = slug.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const product = products.find((p) => p.slug.toLowerCase() === key);
    if (!product || product.kind !== "digital") continue;
    const urls = httpsFileUrls(product.digitalFileUrls || []);
    if (!urls.length) continue;
    out.push({ name: product.name.trim() || product.slug, urls });
  }
  return out;
}

export function cartHasShippedGoods(slugs: string[], products: { slug: string; kind: string }[]): boolean {
  return slugs.some((slug) => {
    const kind = products.find((p) => p.slug.toLowerCase() === slug.trim().toLowerCase())?.kind;
    return Boolean(kind && kind !== "digital");
  });
}

/** Slugs saved on the order, otherwise digital products named in the order text. */
export function digitalSlugsForOrder(
  order: { digitalSlugs?: string[]; items?: string },
  products: DigitalProductRef[],
): string[] {
  const saved = cleanSlugList(order.digitalSlugs);
  if (saved.length) return saved;
  const items = (order.items || "").toLowerCase();
  if (!items) return [];
  return products
    .filter((p) => p.kind === "digital" && p.name.trim() && items.includes(p.name.trim().toLowerCase()))
    .map((p) => p.slug.trim().toLowerCase())
    .filter((slug, i, all) => slug && all.indexOf(slug) === i);
}

/**
 * Stripe retries the webhook. A finished send must not go out again.
 * "sending" means the first attempt is still in flight.
 */
export function webhookDigitalAction(
  existing: { digitalEmailed?: boolean; digitalEmailError?: string } | undefined,
  downloadCount: number,
): "skip" | "send" {
  if (!downloadCount) return "skip";
  if (!existing) return "send";
  if (existing.digitalEmailed) return "skip";
  if (existing.digitalEmailError === "sending") return "skip";
  return "send";
}

export function deliveryEmailText(
  name: string,
  downloads: DigitalDownload[],
  alsoPhysical: boolean,
): string {
  const lines = [
    name ? `Hi ${name},` : "Hi,",
    "",
    "Thanks for your order from Big Horn Custom Works.",
    "Your download links are below. The files are not attached to this email.",
  ];
  if (alsoPhysical) {
    lines.push("Anything else in this order is packed separately.");
  }
  lines.push("");
  for (const item of downloads) {
    lines.push(item.name);
    for (const url of item.urls) lines.push(url);
    lines.push("");
  }
  lines.push(
    "Save the files when you can. Reply to this email if a link does not open.",
    "",
    "— Clint, Big Horn Custom Works",
  );
  return lines.join("\n");
}

export function downloadBadge(order: {
  digitalEmailed?: boolean;
  digitalEmailError?: string;
  fulfillment?: string;
  digitalSlugs?: string[];
}): "" | "emailed" | "failed" | "pending" {
  const digital =
    order.fulfillment === "digital" ||
    (order.digitalSlugs || []).length > 0 ||
    order.digitalEmailed === true ||
    Boolean(order.digitalEmailError);
  if (!digital) return "";
  if (order.digitalEmailed) return "emailed";
  if (order.digitalEmailError && order.digitalEmailError !== "sending") return "failed";
  return "pending";
}

export function downloadStatusLabel(order: {
  digitalEmailed?: boolean;
  digitalEmailError?: string;
  fulfillment?: string;
  digitalSlugs?: string[];
}): string {
  const badge = downloadBadge(order);
  if (badge === "emailed") return "Download emailed";
  if (badge === "failed") return "Download email failed";
  if (badge === "pending") return "Download not emailed yet";
  return "";
}
