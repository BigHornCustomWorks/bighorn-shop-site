import { cleanStr } from "./sanitize";

export type Carrier = {
  id: string;
  name: string;
};

/** The carriers Clint actually ships with out of Sheridan. */
export const CARRIERS: Carrier[] = [
  { id: "usps", name: "USPS" },
  { id: "ups", name: "UPS" },
  { id: "fedex", name: "FedEx" },
  { id: "other", name: "Other" },
];

export function carrierName(id: string): string {
  const hit = CARRIERS.find((c) => c.id === cleanStr(id).toLowerCase());
  return hit ? hit.name : "";
}

/**
 * Public tracking page for a number. Returns "" for carriers we have no link
 * for, so callers send the bare number rather than a broken URL.
 */
export function trackingUrl(carrierId: string, trackingNumber: string): string {
  const num = encodeURIComponent(cleanStr(trackingNumber).replace(/\s+/g, ""));
  if (!num) return "";
  switch (cleanStr(carrierId).toLowerCase()) {
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${num}`;
    case "ups":
      return `https://www.ups.com/track?tracknum=${num}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${num}`;
    default:
      return "";
  }
}
