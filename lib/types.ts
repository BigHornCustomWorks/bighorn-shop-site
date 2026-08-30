export type ProductVariant = {
  id: string;
  name: string;
};

export type ProductKind = "physical" | "digital";

export type ShopCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  description: string;
  media: string[];
  photos: string[];
  videos: string[];
  category: string;
  kind: ProductKind;
  digitalNote: string;
  variants: ProductVariant[];
  variantNote: string;
  visible: boolean;
  sortOrder: number;
  stripeProductId: string;
  stripePriceId: string;
  stripePriceCents: number;
};

export type Quote = {
  id: string;
  name: string;
  email: string;
  phone: string;
  need: string;
  photoUrl: string;
  createdAt: string;
  read: boolean;
  emailed: boolean;
};

export type FooterLink = {
  id: string;
  label: string;
  url: string;
};

export type SiteCopy = {
  companyName: string;
  legalName: string;
  taglineLine1: string;
  taglineLine2: string;
  taglineLine3: string;
  whoWeAre: string;
  whatWeMake: string;
  aboutBody: string;
  contactEmail: string;
  linkedinUrl: string;
  location: string;
  shippingNote: string;
  shippingCents: number;
  repairStatusLabel: string;
  repairStatusLine: string;
  repairStatusUrl: string;
  logoUrl: string;
  heroUrl: string;
  heroVideoUrl: string;
  footerNote: string;
  footerLinks: FooterLink[];
  shopFloorNotes: string;
};

export type ShopSettings = {
  stripeSecretKey: string;
  stripeMode: "test" | "live";
  /** Which Stripe mode the cached stripeProductId / stripePriceId values belong to. */
  catalogMode: "test" | "live" | "";
};

export type ShopStats = {
  pageViews: number;
  uniqueVisitors: number;
};

export type ShopOrder = {
  id: string;
  createdAt: string;
  email: string;
  name: string;
  amountCents: number;
  items: string;
  address: string;
  sessionId: string;
  emailed: boolean;
  read: boolean;
};

export type ShopStore = {
  products: Product[];
  categories: ShopCategory[];
  quotes: Quote[];
  orders: ShopOrder[];
  site: SiteCopy;
  settings: ShopSettings;
  stats: ShopStats;
  updatedAt: string;
};
