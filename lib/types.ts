export type ProductVariant = {
  id: string;
  name: string;
};

export type ProductKind = "physical" | "digital" | "sign";

export type SignUnit = "sqft" | "sqin";

export type SignFinish = {
  id: string;
  name: string;
  /** Extra cents. `per_sqft` is per square foot of finished sign; `flat` is a one-time add-on. */
  extraCents: number;
  extraKind: "per_sqft" | "flat";
  note: string;
  visible: boolean;
};

/** Shop-wide metal-sign estimator. Rate is set in Master Control; size is entered by the customer. */
export type MetalSignsConfig = {
  visible: boolean;
  heading: string;
  lede: string;
  note: string;
  unit: SignUnit;
  /** Cents charged per square foot or per square inch, matching `unit`. */
  rateCents: number;
  /** Floor for a finished sign. 0 means no minimum. */
  minCents: number;
  minWidthIn: number;
  minHeightIn: number;
  maxWidthIn: number;
  maxHeightIn: number;
  /**
   * Legacy flat postage. Used only when base and per-sq-ft shipping are both 0.
   * 0 then falls through to the shop-wide shipping options.
   */
  shippingCents: number;
  /** Minimum postage for a custom-size sign. */
  shippingBaseCents: number;
  /** Extra postage per square foot of finished sign. */
  shippingPerSqFtCents: number;
  /** 0 = no cap. */
  shippingMaxCents: number;
  finishes: SignFinish[];
  media: string[];
  pack: SignPackConfig;
};

/** How a custom sign is packed and weighed for live carrier rates. */
export type SignPackConfig = {
  material: "steel" | "aluminum";
  /** lb per cubic inch. Defaults: steel 0.284, aluminum 0.0975. */
  steelDensityLbPerIn3: number;
  aluminumDensityLbPerIn3: number;
  /** Thicknesses offered in the admin picker, in inches. */
  thicknessOptionsIn: number[];
  thicknessIn: number;
  /** Flat pack = sign size plus this margin on every side. */
  marginIn: number;
  /** Flat pack depth. */
  depthIn: number;
  /** Corrugated board weight per square foot, counted on both faces of the pack. */
  cardboardOzPerSqFt: number;
  /** Tape, corner guards, filler. */
  allowanceOz: number;
};

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
  /** What it costs to ship this item. 0 means fall back to the shop-wide rates. */
  shippingCents: number;
  /**
   * Live carrier rates. weightOz is the item alone (no box), always stored in
   * ounces; weightUnit only remembers how Clint prefers to type it. The box
   * comes from a package preset in Settings unless all three override
   * dimensions are filled in, in which case boxWeightOz is that box's empty
   * weight. 0 item weight or no box = "not measured" → flat shipping.
   */
  weightOz: number;
  weightUnit: "oz" | "lb";
  packagePresetId: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  boxWeightOz: number;
  /** Shown instead of currency when set (e.g. From $49/mo, Coming soon). */
  priceLabel: string;
  /** If set, product is a link-out (no cart) — CTA goes here. */
  externalUrl: string;
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
  kind: "general" | "sign";
  widthIn: number;
  heightIn: number;
  finishName: string;
  fulfillment: string;
  estimateLabel: string;
  sampleUrl: string;
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
  /** Name shown for shipping when the price comes from the items themselves. */
  perItemShippingLabel: string;
  /** Offer $0 local pickup on Stripe next to paid shipping. */
  pickupEnabled: boolean;
  pickupLabel: string;
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

/** A postal address for carrier rates and labels. Empty strings when unknown. */
export type ShipAddress = {
  name: string;
  company: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
};

/** A reusable shipping box. */
export type PackagePreset = {
  id: string;
  name: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  emptyWeightOz: number;
};

export type ShopSettings = {
  stripeSecretKey: string;
  stripeMode: "test" | "live";
  /** Which Stripe mode the cached stripeProductId / stripePriceId values belong to. */
  catalogMode: "test" | "live" | "";
  /** Only turn on once Stripe Tax is activated in the Stripe Dashboard. */
  taxEnabled: boolean;
  /**
   * How per-item shipping costs combine on a multi-item order.
   * "highest" charges the dearest item only, on the assumption things ship
   * together. "sum" charges every item, for goods that need their own box.
   */
  shippingCombine: "highest" | "sum";
  /**
   * Business ship-from address for live rates and labels. Blank fields fall
   * back to the SHIP_FROM_* env vars. Never a home address.
   */
  shipFrom: ShipAddress;
  packagePresets: PackagePreset[];
  /** Added once per parcel for tape, filler, inserts. Ounces. */
  packagingAllowanceOz: number;
};

export type DayStat = {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
};

export type TrafficSources = {
  facebook: number;
  instagram: number;
  google: number;
  direct: number;
  other: number;
};

export type ShopStats = {
  pageViews: number;
  uniqueVisitors: number;
  days: DayStat[];
  sources: TrafficSources;
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
  /** Stripe payment_status at checkout completion ("paid", "unpaid", …). "" on older orders. */
  paymentStatus: string;
  /** Structured copy of the Stripe shipping address, for buying the label. */
  shipTo: ShipAddress;
  /** Shippo rate the customer paid for. Empty when flat shipping or pickup was used. */
  rateId: string;
  rateShipmentId: string;
  rateCarrier: string;
  rateService: string;
  rateServiceToken: string;
  rateCents: number;
  /** Rate a re-rate quoted (awaiting confirm) or the rate the label was bought on. */
  labelRateId: string;
  /** "" | "buying" | "bought" | "error" */
  labelStatus: string;
  labelStartedAt: string;
  labelError: string;
  labelUrl: string;
  labelTrackingUrl: string;
  labelCarrier: string;
  labelService: string;
  labelCents: number;
  labelBoughtAt: string;
};


export type GalleryPhoto = {
  id: string;
  src: string;
  caption: string;
  alt: string;
  simulated?: boolean;
};

export type GallerySection = {
  id: string;
  title: string;
  subtitle: string;
  visible: boolean;
  sortOrder: number;
  photos: GalleryPhoto[];
};

export type ShopStore = {
  products: Product[];
  categories: ShopCategory[];
  quotes: Quote[];
  orders: ShopOrder[];
  site: SiteCopy;
  gallery: GallerySection[];
  metalSigns: MetalSignsConfig;
  settings: ShopSettings;
  stats: ShopStats;
  updatedAt: string;
};
