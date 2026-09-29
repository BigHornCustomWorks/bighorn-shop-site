import assert from "node:assert/strict";
import { test } from "node:test";
import { serviceLeadText, serviceNeedLabel } from "../lib/service-lead.ts";

test("service request email names the job and the photo links, with no price", () => {
  assert.equal(serviceNeedLabel("print"), "3D print");
  const text = serviceLeadText({
    name: "Ada",
    email: "ada@example.com",
    phone: "307-555-0100",
    serviceType: "replacement",
    description: "Broken way-cover bracket",
    fitNotes: "Two 1/4 in holes, 3 in apart",
    approxSize: "about 4 in",
    preferredContact: "phone",
    photoUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
    createdAt: "2026-09-29T18:00:00.000Z",
  });
  assert.match(text, /Replacement part/);
  assert.match(text, /Broken way-cover bracket/);
  assert.match(text, /Two 1\/4 in holes/);
  assert.match(text, /about 4 in/);
  assert.match(text, /Phone/);
  assert.match(text, /Photos attached: 2/);
  assert.match(text, /https:\/\/example.com\/b.jpg/);
  assert.equal(text.includes("$"), false);
});
