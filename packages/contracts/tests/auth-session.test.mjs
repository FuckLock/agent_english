import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ACCOUNT_STATUS_KINDS,
  AUTH_ERROR_CODES,
} from "../dist/index.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("auth session contract exposes account states", () => {
  assert.deepEqual(ACCOUNT_STATUS_KINDS, [
    "guest",
    "signed-in",
    "dev-pro",
    "dev-max",
  ]);
});

test("auth session dev login fixture preserves cross-boundary field names", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(fixturesDir, "auth-session-dev-login.json"),
      "utf8",
    ),
  );

  assert.equal(fixture.session.sessionToken, "session_fixture_dev_pro");
  assert.equal(fixture.session.expiresAt, "2026-06-21T00:00:00Z");
  assert.equal(fixture.session.account.kind, "dev-pro");
  assert.equal(fixture.session.account.serviceTier, "pro");
  assert.equal(fixture.session.account.email, "test-pro@agentenglish.local");
  assert.equal(fixture.session.entitlement.account.kind, "dev-pro");
  assert.equal(fixture.session.entitlement.serviceTier, "pro");
  assert.equal(fixture.session.entitlement.quota.remaining, 188);
  assert.equal(fixture.session.entitlement.catalog.defaultModelId, "pro-context");
  assert.deepEqual(fixture.session.entitlement.catalog.availableTiers, [
    "free",
    "pro",
    "max",
  ]);
  assert.equal(fixture.session.entitlement.catalog.options[2].requiredTier, "max");
});

test("auth session contract exposes auth error codes", () => {
  assert.deepEqual(AUTH_ERROR_CODES, [
    "auth-disabled",
    "invalid-credentials",
    "identity-token-invalid",
    "session-invalid",
  ]);
});
