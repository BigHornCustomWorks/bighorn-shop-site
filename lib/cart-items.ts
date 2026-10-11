import { asInt, cleanStr } from "./sanitize";
import { designSlug, lookupDesignSize, parseDesignCart, sizeLabel } from "./sign-designs";
import { signParcel } from "./shipping";
import type { Product, ShopStore, SignDesign, SignDesignSize } from "./types";

export type CartItem = { product: Product; quantity: number; variant: string };

/**
 * Turns the browser's cart rows into real catalog items. Prices, weights and
 * visibility always come from the store, never from the request. A ready-to-cut
 * design is priced from its saved size the same way. Shared by checkout and the
 * live-rate lookup so both see the same cart.
 */

/** A priced design becomes a measured sign for checkout. The price is the stored size. */
function designCheckoutProduct(store: ShopStore, design: SignDesign, size: SignDesignSize): Product {
  const parcel = signParcel(store.metalSigns, size.widthIn, size.heightIn);
  const label = sizeLabel(size);
  const photo = design.image;
  return {
    id: `signdesign:${design.id}:${size.id}`,
    slug: designSlug(design.id),
    name: design.name.trim(),
    sku: "",
    priceCents: size.priceCents,
    description: `${label}. Ready to cut.`,
    media: photo ? [photo] : [],
    groupCover: "",
    photos: photo ? [photo] : [],
    videos: [],
    category: "Metal signs",
    kind: "sign",
    digitalNote: "",
    digitalFileUrls: [],
    variants: [{ id: size.id, name: label, priceCents: size.priceCents, onHand: null }],
    variantNote: "",
    visible: true,
    onHand: null,
    sortOrder: 0,
    stripeProductId: "",
    stripePriceId: "",
    stripePriceCents: 0,
    stripeTaxBehavior: "",
    shippingCents: 0,
    weightOz: parcel && parcel.weight > 0 ? parcel.weight : 0,
    weightUnit: "oz",
    packagePresetId: "",
    lengthIn: parcel?.length || 0,
    widthIn: parcel?.width || 0,
    heightIn: parcel?.height || 0,
    boxWeightOz: 0,
    priceLabel: "",
    externalUrl: "",
  };
}

/** A design id in the cart that is not a priced size. The line must not be dropped quietly. */
export function unavailableDesign(store: ShopStore, rows: unknown): boolean {
  const itemsIn = Array.isArray(rows) ? rows : [];
  return itemsIn.some((row: { productId?: string }) => {
    const designRef = parseDesignCart(cleanStr(row?.productId));
    if (!designRef) return false;
    return !lookupDesignSize(store.metalSigns.designs, designRef.designId, designRef.sizeId);
  });
}

export function resolveCartItems(store: ShopStore, rows: unknown): CartItem[] {
  const itemsIn = Array.isArray(rows) ? rows : [];
  return itemsIn
    .map((row: { productId?: string; quantity?: number; variant?: string }) => {
      const designRef = parseDesignCart(cleanStr(row?.productId));
      if (designRef) {
        const found = lookupDesignSize(store.metalSigns.designs, designRef.designId, designRef.sizeId);
        if (!found) return null;
        return {
          product: designCheckoutProduct(store, found.design, found.size),
          quantity: asInt(row.quantity, 1),
          variant: sizeLabel(found.size),
        };
      }
      const product = store.products.find((p) => p.id === cleanStr(row?.productId));
      // Hidden physical and sign items are not for sale. A hidden digital item
      // can still be checked out from its own address, so it stays off the catalog.
      if (!product || (!product.visible && product.kind !== "digital")) return null;
      // Link-out / coming-soon digital services are not Stripe cart items.
      if (product.externalUrl || /coming soon/i.test(product.priceLabel || "")) return null;
      return {
        product,
        quantity: asInt(row.quantity, 1),
        variant: cleanStr(row.variant),
      };
    })
    .filter(Boolean) as CartItem[];
}
