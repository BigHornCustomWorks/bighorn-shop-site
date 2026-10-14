/** Letter-size packing slip. Amounts stay on the receipt. */

import type { ShipAddress, ShopOrder } from "./types";

export type PaperSlip = {
  company: string;
  orderId: string;
  date: string;
  from: string;
  shipTo: string;
  items: string;
  service: string;
  tracking: string;
};

function line(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function br(value: string): string {
  return esc(value).replace(/\n/g, "<br />");
}

export function paperWhen(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return line(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(t));
}

export function postalLines(address: Partial<ShipAddress> | null | undefined, fallbackName = ""): string {
  if (!address) return "";
  const city = line(address.city);
  const state = line(address.state);
  const zip = line(address.zip);
  const place = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const country = line(address.country);
  const name = line(address.name) || line(fallbackName);
  const company = line(address.company);
  return [
    name,
    company && company.toLowerCase() !== name.toLowerCase() ? company : "",
    line(address.street1),
    line(address.street2),
    place,
    country && country !== "US" ? country : "",
    line(address.phone),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Prefer the saved street address. Fall back to the text address on the order. */
export function customerShipLines(order: Pick<ShopOrder, "name" | "address" | "phone" | "shipTo">): string {
  if (line(order.shipTo?.street1)) return postalLines(order.shipTo, order.name);
  const address = line(order.address);
  const name = line(order.name);
  const phone = line(order.phone);
  const rows: string[] = [];
  if (name && !address.toLowerCase().includes(name.toLowerCase())) rows.push(name);
  if (address) rows.push(address);
  if (phone && !address.includes(phone)) rows.push(phone);
  return rows.join("\n");
}

/** Business return block. No street is invented when ship-from is blank. */
export function shopFromLines(company: string, from: Partial<ShipAddress> | null | undefined): string {
  const brand = line(company) || "Big Horn Custom Works";
  if (line(from?.street1)) return postalLines(from, brand) || `${brand}\nSheridan, Wyoming`;
  return `${brand}\nSheridan, Wyoming`;
}

export function packingSlipFromOrder(
  order: Pick<
    ShopOrder,
    "id" | "createdAt" | "name" | "items" | "address" | "phone" | "shipTo" | "shippingLabel" | "trackingNumber" | "trackingCarrier" | "labelCarrier"
  >,
  opts: { company: string; from: Partial<ShipAddress> | null | undefined },
): PaperSlip {
  const carrier = line(order.trackingCarrier) || line(order.labelCarrier);
  const trackingNumber = line(order.trackingNumber);
  return {
    company: line(opts.company) || "Big Horn Custom Works",
    orderId: line(order.id) || "—",
    date: paperWhen(order.createdAt),
    from: shopFromLines(opts.company, opts.from),
    shipTo: customerShipLines(order),
    items: line(order.items) || "(none listed)",
    service: line(order.shippingLabel),
    tracking: [carrier, trackingNumber].filter(Boolean).join(" "),
  };
}

const CSS = `
@page { size: letter; margin: 0.6in; }
* { box-sizing: border-box; }
body { margin: 0; color: #1c1915; font-family: Georgia, "Times New Roman", serif; font-size: 14px; line-height: 1.45; }
h1 { font-family: Arial, sans-serif; font-size: 22px; letter-spacing: 0.12em; font-weight: 600; margin: 0; }
h2 { font-family: Arial, sans-serif; font-size: 12px; letter-spacing: 0.14em; font-weight: 600; margin: 0 0 6px; text-transform: uppercase; }
.shop { text-align: center; margin: 0 0 18px; }
.shop p { margin: 6px 0 0; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin: 0 0 18px; }
.ship-to { font-size: 16px; }
table { border-collapse: collapse; width: 100%; max-width: 340px; margin-top: 8px; }
td { padding: 3px 12px 3px 0; vertical-align: top; }
td.amt { text-align: right; white-space: nowrap; }
.total td { font-weight: 700; border-top: 1px solid #1c1915; padding-top: 6px; }
.items { white-space: pre-wrap; margin: 0; }
.sheet { break-after: page; page-break-after: always; }
.sheet:last-child { break-after: auto; page-break-after: auto; }
.noprint { margin: 0 0 16px; }
button { font: 16px Arial, sans-serif; padding: 8px 14px; cursor: pointer; }
@media print { .noprint { display: none !important; } }
`;

export function paperDocument(title: string, sheets: string[], autoPrint: boolean): string {
  const print = autoPrint
    ? `<script>window.addEventListener("load",function(){window.print()});</script>`
    : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>${esc(title)}</title><style>${CSS}</style></head><body><p class="noprint"><button type="button" onclick="window.print()">Print</button></p>${sheets.join("\n")}${print}</body></html>`;
}

export function packingSlipSheet(slip: PaperSlip): string {
  const service = slip.service ? `<p>Service ${esc(slip.service)}</p>` : "";
  const tracking = slip.tracking ? `<p>Tracking ${esc(slip.tracking)}</p>` : "";
  const shipTo = slip.shipTo ? br(slip.shipTo) : "No shipping address on this order.";
  return `<section class="sheet"><div class="shop"><h1>Packing slip</h1><p>${esc(slip.company)}<br />Sheridan, Wyoming</p></div><p>Order ${esc(slip.orderId)}<br />Date ${esc(slip.date)}</p><div class="cols"><div><h2>From</h2><p>${br(slip.from)}</p></div><div class="ship-to"><h2>Ship to</h2><p>${shipTo}</p></div></div>${service}${tracking}<h2>In this box</h2><p class="items">${esc(slip.items)}</p><p>Check the contents against this list.</p></section>`;
}
