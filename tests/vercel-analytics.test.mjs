import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsWindow,
  countryLabel,
  deviceLabel,
  linesFromRows,
  referrerLabel,
} from "../lib/vercel-analytics.ts";

test("a traffic window is 7 or 30 days", () => {
  const now = new Date("2026-10-13T12:00:00.000Z");
  const week = analyticsWindow(7, now);
  assert.equal(week.days, 7);
  assert.equal(week.until, "2026-10-13T12:00:00.000Z");
  assert.equal(week.since, "2026-10-06T12:00:00.000Z");
  assert.equal(analyticsWindow(30, now).days, 30);
  assert.equal(analyticsWindow(12, now).days, 7);
});

test("visitor rows use plain labels", () => {
  assert.equal(countryLabel("US"), "United States");
  assert.equal(countryLabel("others"), "Other");
  assert.equal(referrerLabel(""), "Direct");
  assert.equal(referrerLabel("www.facebook.com"), "facebook.com");
  assert.equal(deviceLabel("mobile"), "Phone");
  assert.deepEqual(
    linesFromRows(
      [{ referrerHostname: "l.facebook.com", visitors: 4, pageviews: 9 }],
      "referrerHostname",
      referrerLabel,
    ),
    [{ label: "l.facebook.com", visitors: 4, pageviews: 9 }],
  );
});
