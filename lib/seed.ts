import type { Product, ShopStore, SiteCopy } from "./types";

export function defaultSite(): SiteCopy {
  return {
    companyName: "Big Horn Custom Works",
    legalName: "Big Horn Custom Works LLC",
    taglineLine1: "Designed to solve problems.",
    taglineLine2: "Built tough to last.",
    taglineLine3: "Crafted with purpose.",
    whoWeAre:
      "Big Horn Custom Works is Clint Stussi’s Sheridan, Wyoming shop — custom design, fabrication, repair, and one-off solutions. Every piece is built by hand, from 3D-printed mill upgrades to metal fab and the apps a local business actually needs on the floor.",
    whatWeMake:
      "Custom fabrication, 3D-printed parts, mill upgrades, and one-offs when the right part does not exist yet.",
    aboutBody:
      "Sheridan shop. Built by hand. Designed things that do not exist, rebuilt things that did. Apps for businesses when the floor needs a tool, not a spreadsheet.\n\nI am a small-batch custom designer for 3D-printed solutions and a metal fabrication shop based in Sheridan, Wyoming. Every piece is built with pride and purpose.",
    contactEmail: "bighorncustomworks@gmail.com",
    linkedinUrl: "https://www.linkedin.com/in/clint-stussi-b7717a42a",
    location: "Sheridan, Wyoming",
    shippingNote:
      "Ships from Sheridan, WY. Shipping is calculated at checkout — no invented rates. If extra postage applies, Clint will confirm before the order ships.",
    shippingCents: 0,
    repairStatusLabel: "Repair Status",
    repairStatusLine:
      "Shop management software, live at repairstatus.site. A product of Big Horn Custom Works — not sold in this catalog.",
    repairStatusUrl: "https://repairstatus.site",
    logoUrl: "/logo.png",
    heroUrl: "/hero.jpg",
    footerNote: "Big Horn Custom Works LLC · Sheridan, Wyoming",
    footerLinks: [
      { id: "privacy", label: "Privacy", url: "/privacy" },
      { id: "terms", label: "Terms", url: "/terms" },
      { id: "repair", label: "Repair Status", url: "https://repairstatus.site" },
    ],
    shopFloorNotes:
      "Shop-floor calls (edit these):\n• Shipping starts as a note, not a made-up rate. Set a flat amount in cents only if you want it added at Stripe Checkout.\n• Repair Status is a text link, never a catalog item and never $0.\n• Stripe is in test mode until you put live keys in Vercel env or the Stripe key field below.\n• Public pages ignore messy HTML/JS in these fields so a stray edit cannot crash the site.",
  };
}

export function defaultProducts(): Product[] {
  return [
    {
      id: "prod_way_covers",
      slug: "baffled-y-and-z-way-covers",
      name: "Baffled Y and Z way covers",
      priceCents: 16000,
      description:
        "For Precision Matthews PM-728 / PM-728VT. Custom-engineered Y and Z axis way covers designed to shield critical machine surfaces from chips and dust across three sides. Glass-reinforced TPU, 3D printed, heat and abrasion resistant. Set includes custom mounting brackets and hardware that attach to existing machine holes. No extra drilling.",
      photos: ["/products/way-covers-1.jpg", "/products/way-covers-2.jpg"],
      variants: [],
      variantNote: "",
      visible: true,
      sortOrder: 1,
    },
    {
      id: "prod_t_slot",
      slug: "t-slot-covers",
      name: "T-Slot covers",
      priceCents: 3999,
      description:
        "For Precision Matthews PM-728VT bed T-slots. Dual-material 3D printed: hard outer shell that resists hot chips and abrasion, softer flexible layer that snaps in. Keeps chips, coolant, and debris out of the T-slots. Easy to install and remove.",
      photos: ["/products/t-slot-1.jpg", "/products/t-slot-2.png"],
      variants: [
        { id: "black", name: "Black" },
        { id: "blue", name: "Blue" },
        { id: "red", name: "Red" },
        { id: "gray", name: "Gray" },
      ],
      variantNote:
        "If they pick a color other than black, ONLY the top is that color. Rubber bottom stays black. Note: Clint can print on demand within 24 hours if inventory is low.",
      visible: true,
      sortOrder: 2,
    },
    {
      id: "prod_spindle",
      slug: "sliding-spindle-lock",
      name: "Sliding Spindle lock",
      priceCents: 13499,
      description:
        "For Precision Matthews PM-728VT. Replaces the stock spindle lock with a sliding mechanism. Locks the spindle with one motion. Solid steel. Hardware included. No mill modifications.",
      photos: [
        "/products/spindle-1.jpg",
        "/products/spindle-2.jpg",
        "/products/spindle-3.png",
      ],
      variants: [],
      variantNote: "",
      visible: true,
      sortOrder: 3,
    },
  ];
}

export function seedStore(): ShopStore {
  return {
    products: defaultProducts(),
    quotes: [],
    site: defaultSite(),
    settings: {
      stripeSecretKey: "",
      stripeMode: "test",
    },
    updatedAt: "",
  };
}
