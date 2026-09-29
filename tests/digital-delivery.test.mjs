import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_DIGITAL_NOTE,
  MANUAL_DIGITAL_NOTE,
  cartHasShippedGoods,
  collectDigitalDownloads,
  deliveryEmailText,
  downloadBadge,
  honestDigitalNote,
  httpsFileUrls,
  webhookDigitalAction,
} from "../lib/digital-delivery.ts";

const zip = "https://example.public.blob.vercel-storage.com/plans.zip";
const products = [
  { slug: "hidden-plans", name: "Hidden plans", kind: "digital", digitalFileUrls: [zip] },
  { slug: "no-file", name: "Notes only", kind: "digital", digitalFileUrls: [] },
  { slug: "way-covers", name: "Way covers", kind: "physical", digitalFileUrls: [zip] },
];

test("file links are https only", () => {
  const urls = httpsFileUrls([
    zip,
    "http://example.com/file.zip",
    "javascript:alert(1)",
    "/uploads/file.zip",
    zip,
    "https://user:pass@example.com/secret.zip",
    "not a url",
  ]);
  assert.deepEqual(urls, [zip]);
});

test("a digital line with links is emailed and a physical cart is not", () => {
  assert.deepEqual(collectDigitalDownloads(["way-covers"], products), []);
  assert.deepEqual(collectDigitalDownloads(["no-file"], products), []);
  assert.deepEqual(collectDigitalDownloads(["hidden-plans", "way-covers"], products), [
    { name: "Hidden plans", urls: [zip] },
  ]);
  assert.equal(cartHasShippedGoods(["hidden-plans"], products), false);
  assert.equal(cartHasShippedGoods(["hidden-plans", "way-covers"], products), true);
});

test("the delivery email is links, not a price or an attachment", () => {
  const text = deliveryEmailText("Ada", [{ name: "Hidden plans", urls: [zip] }], false);
  assert.match(text, new RegExp(zip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(text, /not attached/);
  assert.equal(text.includes("$"), false);
  assert.match(text, /Hi Ada,/);
  const mixed = deliveryEmailText("Ada", [{ name: "Hidden plans", urls: [zip] }], true);
  assert.match(mixed, /packed separately/);
});

test("webhook retries do not send a second download email", () => {
  assert.equal(webhookDigitalAction(undefined, 0), "skip");
  assert.equal(webhookDigitalAction(undefined, 1), "send");
  assert.equal(webhookDigitalAction({ digitalEmailed: true, digitalEmailError: "" }, 1), "skip");
  assert.equal(webhookDigitalAction({ digitalEmailed: false, digitalEmailError: "sending" }, 1), "skip");
  assert.equal(webhookDigitalAction({ digitalEmailed: false, digitalEmailError: "SMTP down" }, 1), "send");
});

test("download status stays off physical orders", () => {
  assert.equal(downloadBadge({ fulfillment: "ship", digitalSlugs: [], digitalEmailed: false }), "");
  assert.equal(downloadBadge({ fulfillment: "digital", digitalEmailed: true }), "emailed");
  assert.equal(
    downloadBadge({ digitalSlugs: ["hidden-plans"], digitalEmailed: false, digitalEmailError: "SMTP down" }),
    "failed",
  );
  assert.equal(downloadBadge({ digitalSlugs: ["no-file"], digitalEmailed: false, digitalEmailError: "" }), "pending");
});

test("the product note matches whether a file link is saved", () => {
  assert.equal(honestDigitalNote("", false), MANUAL_DIGITAL_NOTE);
  assert.equal(honestDigitalNote("", true), AUTO_DIGITAL_NOTE);
  assert.equal(
    honestDigitalNote(
      "Digital item. After Stripe payment, Clint emails the file or download link. No shipping.",
      true,
    ),
    AUTO_DIGITAL_NOTE,
  );
  assert.equal(honestDigitalNote("STEP files. Personal use.", true), "STEP files. Personal use.");
});
