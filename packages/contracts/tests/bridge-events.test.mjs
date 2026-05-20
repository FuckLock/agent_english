import test from "node:test";
import assert from "node:assert/strict";

import {
  BRIDGE_BOOT_EVENT_TYPE,
  BRIDGE_PING_EVENT_TYPE,
  createBridgeEvent,
  schemaVersion,
} from "../dist/index.js";

test("createBridgeEvent creates a boot envelope with schema metadata", () => {
  const event = createBridgeEvent(BRIDGE_BOOT_EVENT_TYPE, {
    sessionId: "session-1",
    bridgeScope: "bootstrap",
  });

  assert.equal(event.schemaVersion, schemaVersion);
  assert.equal(event.eventType, BRIDGE_BOOT_EVENT_TYPE);
  assert.deepEqual(event.payload, {
    sessionId: "session-1",
    bridgeScope: "bootstrap",
  });
  assert.equal(event.result, undefined);
  assert.equal(event.error, undefined);
});

test("createBridgeEvent carries ping result and error fields", () => {
  const event = createBridgeEvent(
    BRIDGE_PING_EVENT_TYPE,
    {
      sessionId: "session-1",
      sentAt: "2026-05-20T00:00:00.000Z",
    },
    {
      result: { acknowledged: true },
      error: {
        code: "noop",
        message: "No failure",
      },
    },
  );

  assert.equal(event.eventType, BRIDGE_PING_EVENT_TYPE);
  assert.deepEqual(event.result, { acknowledged: true });
  assert.deepEqual(event.error, {
    code: "noop",
    message: "No failure",
  });
});
