import assert from "node:assert/strict";
import test from "node:test";
import { customMetalCategoryName } from "../lib/sign-category.ts";

test("premade sign categories become Custom metal signs", () => {
  assert.equal(customMetalCategoryName("Pre Made Metal Signs"), "Custom metal signs");
  assert.equal(customMetalCategoryName("Premade signs"), "Custom metal signs");
  assert.equal(customMetalCategoryName("Pre-made metal signs"), "Custom metal signs");
  assert.equal(customMetalCategoryName("  premade   metal   signs "), "Custom metal signs");
});

test("other sign categories stay as written", () => {
  assert.equal(customMetalCategoryName("Halloween"), "Halloween");
  assert.equal(customMetalCategoryName("Family Name Signs"), "Family Name Signs");
  assert.equal(customMetalCategoryName("Metal signs"), "Metal signs");
  assert.equal(customMetalCategoryName("Custom metal signs"), "Custom metal signs");
});
