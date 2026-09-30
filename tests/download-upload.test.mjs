import assert from "node:assert/strict";
import test from "node:test";
import {
  FILE_MAX,
  downloadContentType,
  isDownloadFileName,
  maxForKind,
} from "../lib/uploadLimits.ts";

test("print uploads accept stl, 3mf, step, stp, and zip", () => {
  assert.equal(isDownloadFileName("Bellows.STL"), true);
  assert.equal(isDownloadFileName("bhcw/downloads/part.stp"), true);
  assert.equal(isDownloadFileName("pack.3mf"), true);
  assert.equal(isDownloadFileName("files.zip"), true);
  assert.equal(isDownloadFileName("shot.png"), false);
  assert.equal(isDownloadFileName("notes.txt"), false);
  assert.equal(isDownloadFileName("model.step.txt"), false);
  assert.equal(downloadContentType("a.3mf"), "model/3mf");
  assert.equal(downloadContentType("a.step"), "model/step");
  assert.equal(downloadContentType("a.stp"), "model/step");
  assert.equal(downloadContentType("a.stl"), "model/stl");
  assert.equal(downloadContentType("a.zip"), "application/zip");
  assert.equal(downloadContentType("a.png"), "");
  assert.equal(maxForKind("download"), FILE_MAX);
  assert.equal(maxForKind("photo") < FILE_MAX, true);
});
