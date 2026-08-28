export type ProductVariant = {
  id: string;
  name: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  description: string;
  photos: string[];
  variants: ProductVariant[];
  variantNote: string;
  visible: boolean;
  sortOrder: number;
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
  footerNote: string;
  footerLinks: FooterLink[];
  shopFloorNotes: string;
};

export type ShopSettings = {
  stripeSecretKey: string;
  stripeMode: "test" | "live";
};

export type ShopStore = {
  products: Product[];
  quotes: Quote[];
  site: SiteCopy;
  settings: ShopSettings;
  updatedAt: string;
};
