import test from "node:test";
import assert from "node:assert/strict";

import {
  DISPLAY_MODE_LABELS,
  DisplayModeController,
} from "../dist/index.js";

test("DisplayModeController hides translations in original mode", () => {
  const controller = new DisplayModeController("original");

  assert.equal(controller.currentMode, "original");
  assert.equal(controller.isTranslationVisible("seg-1"), false);
  assert.equal(DISPLAY_MODE_LABELS.original, "Original");
});

test("DisplayModeController shows translations in bilingual mode", () => {
  const controller = new DisplayModeController("bilingual");

  assert.equal(controller.isTranslationVisible("seg-1"), true);
  assert.equal(controller.isSegmentCollapsed("seg-1"), false);
});

test("DisplayModeController keeps learning segments hidden until expanded", () => {
  const controller = new DisplayModeController("learning");

  assert.equal(controller.isTranslationVisible("seg-1"), false);
  assert.equal(controller.isSegmentCollapsed("seg-1"), true);
  assert.equal(controller.toggleSegment("seg-1"), true);
  assert.equal(controller.isTranslationVisible("seg-1"), true);
  assert.equal(controller.toggleSegment("seg-1"), false);
});
