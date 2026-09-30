import assert from "node:assert/strict";
import test from "node:test";
import { DIGITAL_FILES, DIGITAL_SOFTWARE, digitalSection } from "../lib/digital-sections.ts";

test("software and file downloads stay in different sections", () => {
  assert.equal(digitalSection({ slug: "repair-status", name: "Repair Status", category: "Digital products" }), "software");
  assert.equal(digitalSection({ name: "Google review collection", category: "Digital products" }), "software");
  assert.equal(digitalSection({ name: "Google review collection", category: DIGITAL_SOFTWARE }), "software");
  assert.equal(digitalSection({ name: "Mill vise jaws", category: DIGITAL_FILES }), "files");
  assert.equal(digitalSection({ name: "Mill vise jaws", category: "STL files" }), "files");
  assert.equal(digitalSection({ name: "Bracket", category: "CAD models" }), "files");
});
