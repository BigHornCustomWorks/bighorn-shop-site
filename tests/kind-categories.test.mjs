import assert from "node:assert/strict";
import test from "node:test";
import { categoriesForKind } from "../lib/kind-categories.ts";

const categories = [
  { name: "Mill accessories" },
  { name: "3D printer dogs" },
  { name: "Software" },
  { name: "Halloween" },
  { name: "Family Name Signs" },
  { name: "Christmas" },
];

const products = [
  { kind: "physical", category: "Mill accessories" },
  { kind: "physical", category: "3D printer dogs" },
  { kind: "digital", category: "Software" },
  { kind: "sign", category: "Halloween" },
  { kind: "sign", category: "Family Name Signs" },
];

test("each Master tab lists only categories used by that kind", () => {
  assert.deepEqual(
    categoriesForKind(categories, products, "sign").map((c) => c.name),
    ["Halloween", "Family Name Signs", "Christmas"],
  );
  assert.deepEqual(
    categoriesForKind(categories, products, "physical").map((c) => c.name),
    ["Mill accessories", "3D printer dogs", "Christmas"],
  );
  assert.deepEqual(
    categoriesForKind(categories, products, "digital").map((c) => c.name),
    ["Software", "Christmas"],
  );
});
