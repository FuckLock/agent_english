import test from "node:test";
import assert from "node:assert/strict";

import {
  REVIEW_FEEDBACK_STATES,
} from "../dist/index.js";

test("review feedback states stay scoped to phase 6 scheduler states", () => {
  assert.deepEqual(REVIEW_FEEDBACK_STATES, [
    "remembered",
    "fuzzy",
    "forgotten",
  ]);
});
