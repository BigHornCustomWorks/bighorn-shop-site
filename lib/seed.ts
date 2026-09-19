import type { GallerySection, MetalSignsConfig, Product, ShopCategory, ShopStore, SiteCopy } from "./types";

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
    shippingOptions: [
      { id: "flat", label: "Flat rate shipping", amountCents: 1499, minDays: 3, maxDays: 7 },
    ],
    perItemShippingLabel: "Shipping from Sheridan, WY",
    repairStatusLabel: "Repair Status",
    repairStatusLine:
      "Shop management software, live at repairstatus.site. A product of Big Horn Custom Works — not sold in this catalog.",
    repairStatusUrl: "https://repairstatus.site",
    logoUrl: "/logo.png",
    heroUrl: "/hero.jpg",
    heroVideoUrl: "/uploads/1787947574036-grok-video-8029923e-838e-4b53-b649-9b1858fe608d.mp4",
    footerNote: "Big Horn Custom Works LLC · Sheridan, Wyoming",
    footerLinks: [
      { id: "privacy", label: "Privacy", url: "/privacy" },
      { id: "terms", label: "Terms", url: "/terms" },
      { id: "repair", label: "Repair Status", url: "https://repairstatus.site" },
    ],
    shopFloorNotes:
      "Shop-floor calls (edit these):\n• Shipping starts as a note, not a made-up rate. Set a flat amount in cents only if you want it added at Stripe Checkout.\n• Repair Status is a text link, never a catalog item and never $0.\n• Stripe is in test mode until you put live keys in Vercel env or the Stripe key field below.\n• Public pages ignore messy HTML/JS in these fields so a stray edit cannot crash the site.\n• Categories are a label on each product (Mill accessories, Digital downloads, or a new line you type). Shop filters by that label.\n• Digital products skip shipping at checkout. Delivery note is emailed / Master Control until a download locker is built.\n• Media: one list per product. Upload a photo or video, or paste a URL. Drag to set the order they show on the product page.",
  };
}

export function defaultCategories(): ShopCategory[] {
  return [
    { id: "cat_mill", name: "Mill accessories", sortOrder: 1 },
    { id: "cat_digital", name: "Digital", sortOrder: 2 },
    { id: "cat_signs", name: "Metal signs", sortOrder: 3 },
  ];
}

export function defaultMetalSigns(): MetalSignsConfig {
  return {
    visible: true,
    heading: "CNC plasma-cut metal signs",
    lede: "Enter the finished width and height. Price is the area times the shop rate.",
    note: "Quoted as raw plasma-cut steel unless you ask for paint, powder, or mounting. Odd shapes and extra work still go through a custom quote.",
    unit: "sqft",
    rateCents: 0,
    minCents: 0,
    minWidthIn: 4,
    minHeightIn: 4,
    maxWidthIn: 48,
    maxHeightIn: 48,
    shippingCents: 0,
    media: ["/gallery/gallery-cta-hero.jpg"],
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
      media: [
        "/products/way-covers-1.jpg",
        "/products/way-covers-2.jpg",
      ],
      photos: [
        "/products/way-covers-1.jpg",
        "/products/way-covers-2.jpg",
      ],
      videos: [],
      category: "Mill accessories",
      kind: "physical",
      digitalNote: "",
      variants: [],
      variantNote: "",
      visible: true,
      stripeProductId: "",
      stripePriceId: "",
      stripePriceCents: 0,
      stripeTaxBehavior: "",
      shippingCents: 0,
      priceLabel: "",
      externalUrl: "",
      sortOrder: 1,
    },
    {
      id: "prod_t_slot",
      slug: "t-slot-covers",
      name: "T-Slot covers",
      priceCents: 3999,
      description:
        "For Precision Matthews PM-728VT bed T-slots. Dual-material 3D printed: hard outer shell that resists hot chips and abrasion, softer flexible layer that snaps in. Keeps chips, coolant, and debris out of the T-slots. Easy to install and remove.",
      media: [
        "/products/t-slot-1.jpg",
        "/products/t-slot-2.png",
      ],
      photos: [
        "/products/t-slot-1.jpg",
        "/products/t-slot-2.png",
      ],
      videos: [],
      category: "Mill accessories",
      kind: "physical",
      digitalNote: "",
      variants: [
        { id: "black", name: "Black" },
        { id: "blue", name: "Blue" },
        { id: "red", name: "Red" },
        { id: "gray", name: "Gray" },
      ],
      variantNote:
        "If they pick a color other than black, ONLY the top is that color. Rubber bottom stays black. Note: Clint can print on demand within 24 hours if inventory is low.",
      visible: true,
      stripeProductId: "",
      stripePriceId: "",
      stripePriceCents: 0,
      stripeTaxBehavior: "",
      shippingCents: 0,
      priceLabel: "",
      externalUrl: "",
      sortOrder: 2,
    },
    {
      id: "prod_spindle",
      slug: "sliding-spindle-lock",
      name: "Sliding Spindle lock",
      priceCents: 13499,
      description:
        "For Precision Matthews PM-728VT. Replaces the stock spindle lock with a sliding mechanism. Locks the spindle with one motion. Solid steel. Hardware included. No mill modifications.",
      media: [
        "/products/spindle-1.jpg",
        "/products/spindle-2.jpg",
        "/products/spindle-3.png",
      ],
      photos: [
        "/products/spindle-1.jpg",
        "/products/spindle-2.jpg",
        "/products/spindle-3.png",
      ],
      videos: [],
      category: "Mill accessories",
      kind: "physical",
      digitalNote: "",
      variants: [],
      variantNote: "",
      visible: true,
      stripeProductId: "",
      stripePriceId: "",
      stripePriceCents: 0,
      stripeTaxBehavior: "",
      shippingCents: 0,
      priceLabel: "",
      externalUrl: "",
      sortOrder: 3,
    },
  ];
}

export function defaultGallery(): GallerySection[] {
  const captions = [
    "Sample · House number plaque",
    "Sample · Monogram wall plaque",
    "Sample · Mountain wall art",
    "Sample · Garden welcome stake",
    "Sample · Patio family name",
    "Sample · Porch address plaque",
    "Sample · House number plaque (alt)",
    "Sample · Monogram wall plaque (alt)",
    "Sample · Mountain wall art (alt)",
    "Sample · Garden welcome stake (alt)",
  ];
  const photos = captions.map((caption, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      id: `photo_cnc_${n}`,
      src: `/gallery/cnc-sign-${n}.jpg`,
      caption,
      alt: caption,
      simulated: true,
    };
  });
  return [
    {
      id: "gal_cnc_signs",
      title: "CNC plasma-cut signs",
      subtitle: "Small decorative pieces · Homes",
      visible: true,
      sortOrder: 1,
      photos,
    },
    {
      id: "gal_custom_metal",
      title: "Custom metal signs",
      subtitle: "Coming soon",
      visible: true,
      sortOrder: 2,
      photos: [],
    },
  ];
}


export function seedStore(): ShopStore {
  return {
    products: defaultProducts(),
    categories: defaultCategories(),
    quotes: [],
    orders: [],
    site: defaultSite(),
    gallery: defaultGallery(),
    metalSigns: defaultMetalSigns(),
    settings: {
      stripeSecretKey: "",
      stripeMode: "test",
      catalogMode: "",
      taxEnabled: false,
      shippingCombine: "highest",
    },
    stats: { pageViews: 0, uniqueVisitors: 0, days: [], sources: { facebook: 0, instagram: 0, google: 0, direct: 0, other: 0 } },
    updatedAt: "",
  };
}
