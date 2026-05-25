import test from "node:test";
import assert from "node:assert/strict";

import {
  MODEL_SERVICE_ERROR_CODES,
  MODEL_AVAILABILITY_STATES,
  SERVICE_TIERS,
} from "../dist/index.js";

test("model service contract exposes canonical service tiers", () => {
  assert.deepEqual(SERVICE_TIERS, ["free", "pro", "max"]);
  assert.deepEqual(MODEL_AVAILABILITY_STATES, [
    "available",
    "requiresTier",
    "locked",
  ]);
});

test("model service contract exposes the phase 6 error codes", () => {
  assert.deepEqual(MODEL_SERVICE_ERROR_CODES, [
    "quota-exceeded",
    "tier-unavailable",
    "service-unavailable",
    "content-too-long",
    "provider-fallback-failed",
  ]);
});
