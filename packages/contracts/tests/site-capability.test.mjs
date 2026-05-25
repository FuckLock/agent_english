import test from "node:test";
import assert from "node:assert/strict";

import {
  CORE_SITE_KINDS,
  SITE_CAPABILITIES,
  SITE_KINDS,
} from "../dist/index.js";

test("site capability contract includes core Phase 7 sites and caption states", () => {
  assert.deepEqual(CORE_SITE_KINDS, [
    "youtube",
    "reddit",
    "wikipedia",
    "ao3",
    "x",
  ]);
  assert.ok(SITE_KINDS.includes("generic"));
  assert.ok(SITE_CAPABILITIES.includes("captions-available"));
  assert.ok(SITE_CAPABILITIES.includes("captions-unavailable"));
  assert.ok(SITE_CAPABILITIES.includes("search-results"));
  assert.ok(SITE_CAPABILITIES.includes("comments"));
});
