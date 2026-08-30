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
  /** tax_behavior baked into the Stripe price. Prices without it break Stripe Tax. */
  stripeTaxBehavior: string;
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

export type ShippingOption = {
  id: string;
  /** Shown to the customer on the Stripe payment page, e.g. "USPS Priority Mail". */
  label: string;
  amountCents: number;
  /** Business-day delivery estimate. 0 on either field hides the estimate. */
  minDays: number;
  maxDays: number;
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
  /** Legacy flat rate. Kept so old stores migrate into shippingOptions. */
  shippingCents: number;
  shippingOptions: ShippingOption[];
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
  /** Only turn on once Stripe Tax is activated in the Stripe Dashboard. */
  taxEnabled: boolean;
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
  /** Which shipping service the customer paid for, so the right label gets bought. */
  shippingLabel: string;
  shippingCents: number;
  taxCents: number;
  trackingCarrier: string;
  trackingNumber: string;
  shippedAt: string;
  /** Whether the customer was successfully emailed the tracking number. */
  customerNotified: boolean;
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
