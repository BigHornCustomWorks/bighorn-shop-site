import { safeUrl } from "./sanitize";

/** Repair Status info page. Purchases stay on that site. */
export const REPAIR_STATUS_INFO_URL = "https://repairstatus.site/info";

export function isRepairStatusProduct(product: { slug?: string; name?: string }): boolean {
  const slug = (product.slug || "").trim().toLowerCase();
  const name = (product.name || "").trim().toLowerCase();
  return slug === "repair-status" || name === "repair status";
}

/**
 * A saved root link (https://repairstatus.site) opens the info page.
 * Any other address is left as the owner saved it.
 */
export function repairStatusPublicUrl(raw?: string): string {
  const cleaned = safeUrl(raw || "");
  if (!cleaned) return "";
  try {
    const url = new URL(cleaned);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "repairstatus.site" && host !== "staging.repairstatus.site") return cleaned;
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/info";
      url.hash = "";
      return url.toString();
    }
    return cleaned;
  } catch {
    return cleaned.startsWith("/") ? cleaned : "";
  }
}
