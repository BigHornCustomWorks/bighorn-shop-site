const HTML_TAG = /<\/?[^>]+>/g;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanStr(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  const text = String(value).replace(HTML_TAG, "").replace(CONTROL, "").trim();
  return text || fallback;
}

export function cleanMultiline(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  const text = String(value)
    .replace(HTML_TAG, "")
    .replace(CONTROL, "")
    .replace(/\r\n/g, "\n")
    .trim();
  return text || fallback;
}

export function safeUrl(value: unknown): string {
  const raw = cleanStr(value);
  if (!raw) return "";
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) {
    return raw.split("?")[0] || raw;
  }
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      url.hash = "";
      return url.toString();
    }
  } catch {
    /* ignore messy admin URLs */
  }
  return "";
}

export function safeSlug(value: unknown, fallback = "part"): string {
  const slug = cleanStr(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

export function asInt(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

export function asCents(value: unknown, fallback = 0): number {
  const n = asInt(value, fallback);
  return Math.max(0, Math.min(n, 10_000_000));
}

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
