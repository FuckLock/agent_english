import test from "node:test";
import assert from "node:assert/strict";

import {
  BRIDGE_BOOT_EVENT_TYPE,
  BRIDGE_PING_EVENT_TYPE,
  schemaVersion,
} from "@agent-english/contracts";

import {
  bootstrapBridge,
  createBootEvent,
  createPingEvent,
} from "../dist/index.js";

function createRecordingPort() {
  const events = [];

  return {
    events,
    port: {
      postMessage(event) {
        events.push(event);
      },
    },
  };
}

test("createBootEvent returns a schema-compatible boot envelope", () => {
  const event = createBootEvent({
    sessionId: "session-1",
    bridgeScope: "bootstrap",
  });

  assert.equal(event.schemaVersion, schemaVersion);
  assert.equal(event.eventType, BRIDGE_BOOT_EVENT_TYPE);
  assert.deepEqual(event.payload, {
    sessionId: "session-1",
    bridgeScope: "bootstrap",
  });
});

test("bootstrapBridge posts boot and ping events through the provided port", () => {
  const { events, port } = createRecordingPort();
  const handle = bootstrapBridge({
    port,
    sessionId: "session-1",
    now: () => new Date("2026-05-20T00:00:00.000Z"),
  });

  assert.equal(handle.bootEvent.eventType, BRIDGE_BOOT_EVENT_TYPE);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, BRIDGE_BOOT_EVENT_TYPE);

  const pingEvent = handle.ping();

  assert.equal(pingEvent.eventType, BRIDGE_PING_EVENT_TYPE);
  assert.deepEqual(pingEvent.payload, {
    sessionId: "session-1",
    sentAt: "2026-05-20T00:00:00.000Z",
  });
  assert.deepEqual(pingEvent.result, { acknowledged: false });
  assert.equal(events.length, 2);
  assert.equal(events[1].eventType, BRIDGE_PING_EVENT_TYPE);
});

test("createPingEvent preserves caller supplied timestamp payload", () => {
  const event = createPingEvent({
    sessionId: "session-1",
    sentAt: "2026-05-20T01:02:03.000Z",
  });

  assert.equal(event.schemaVersion, schemaVersion);
  assert.equal(event.eventType, BRIDGE_PING_EVENT_TYPE);
  assert.equal(event.payload.sentAt, "2026-05-20T01:02:03.000Z");
});
