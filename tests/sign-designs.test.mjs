import assert from "node:assert/strict";
import { test } from "node:test";
import {
  designCartId,
  designsForSale,
  lookupDesignSize,
  normalizeSignDesigns,
  parseDesignCart,
  saleSizes,
  signDesignOrderKind,
} from "../lib/sign-designs.ts";

test("a design keeps the price Clint typed and drops anything else", () => {
  const saved = normalizeSignDesigns([
    {
      id: "design_b",
      name: "Moose",
      image: "/gallery/cnc-sign-01.jpg",
      secret: "nope",
      sizes: [
        { id: "size_free", label: "", widthIn: 12, heightIn: 12, priceCents: 0, clientPrice: 1 },
        { id: "size_tiny", label: "", widthIn: 12, heightIn: 12, priceCents: 49 },
        { id: "size_ok", label: "Large", widthIn: 24, heightIn: 18, priceCents: 8500 },
      ],
    },
  ]);
  assert.equal("secret" in saved[0], false);
  assert.equal("clientPrice" in saved[0].sizes[0], false);
  assert.equal(saved[0].sizes[0].priceCents, 0);
  assert.equal(saleSizes(saved[0]).length, 1);
  assert.equal(saleSizes(saved[0])[0].priceCents, 8500);
  assert.equal(designsForSale(saved).length, 1);

  const found = lookupDesignSize(saved, "design_b", "size_ok");
  assert.equal(found && found.size.priceCents, 8500);
  assert.equal(lookupDesignSize(saved, "design_b", "size_free"), null);
  assert.equal(lookupDesignSize(saved, "design_b", "size_tiny"), null);
  assert.equal(lookupDesignSize(saved, "design_b", "missing"), null);

  const parsed = parseDesignCart(designCartId("design_b", "size_ok"));
  assert.deepEqual(parsed, { designId: "design_b", sizeId: "size_ok" });
  assert.equal(lookupDesignSize(saved, parsed.designId, parsed.sizeId).size.priceCents, 8500);
});

test("a design with no photo, no name, or a bad image is not for sale", () => {
  const saved = normalizeSignDesigns([
    { id: "design_blank", name: "", image: "", sizes: [{ id: "size_a", widthIn: 10, heightIn: 10, priceCents: 2000 }] },
    {
      id: "design_noname",
      name: "  ",
      image: "https://example.com/a.jpg",
      sizes: [{ id: "size_a", widthIn: 10, heightIn: 10, priceCents: 2000 }],
    },
    {
      id: "design_script",
      name: "Bad",
      image: "javascript:alert(1)",
      sizes: [{ id: "size_a", widthIn: 10, heightIn: 10, priceCents: 2000 }],
    },
    {
      id: "design_video",
      name: "Clip",
      image: "/uploads/clip.mp4",
      sizes: [{ id: "size_a", widthIn: 10, heightIn: 10, priceCents: 2000 }],
    },
    {
      id: "design_zero_size",
      name: "Flat",
      image: "https://example.com/b.jpg",
      sizes: [{ id: "size_a", widthIn: 0, heightIn: 18, priceCents: 2000 }],
    },
  ]);
  assert.equal(saved.find((d) => d.id === "design_blank"), undefined);
  assert.equal(saved.find((d) => d.id === "design_script").image, "");
  assert.equal(saved.find((d) => d.id === "design_video").image, "");
  assert.equal(designsForSale(saved).length, 0);
  assert.equal(lookupDesignSize(saved, "design_noname", "size_a"), null);
  assert.equal(lookupDesignSize(saved, "design_zero_size", "size_a"), null);
});

test("a cart of only sign designs is labeled as a sign design order", () => {
  assert.equal(signDesignOrderKind(["sign-design-design_b"]), "sign-design");
  assert.equal(signDesignOrderKind(["sign-design-design_b", "way-covers"]), "");
  assert.equal(signDesignOrderKind([]), "");
});
