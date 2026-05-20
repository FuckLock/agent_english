import {
  BRIDGE_BOOT_EVENT_TYPE,
  BRIDGE_PING_EVENT_TYPE,
  createBridgeEvent,
  type BridgeBootPayload,
  type BridgeEvent,
  type BridgePingPayload,
} from "@agent-english/contracts";

export interface BridgeBootstrapPort {
  postMessage(event: BridgeEvent): void;
}

export interface BridgeBootstrapOptions {
  port: BridgeBootstrapPort;
  sessionId: string;
  now?: () => Date;
}

export interface BridgeBootstrapHandle {
  bootEvent: BridgeEvent<typeof BRIDGE_BOOT_EVENT_TYPE>;
  ping(): BridgeEvent<typeof BRIDGE_PING_EVENT_TYPE>;
}

export function createBootEvent(
  payload: BridgeBootPayload,
): BridgeEvent<typeof BRIDGE_BOOT_EVENT_TYPE> {
  return createBridgeEvent(BRIDGE_BOOT_EVENT_TYPE, payload);
}

export function createPingEvent(
  payload: BridgePingPayload,
): BridgeEvent<typeof BRIDGE_PING_EVENT_TYPE> {
  return createBridgeEvent(BRIDGE_PING_EVENT_TYPE, payload, {
    result: { acknowledged: false },
  });
}

export function bootstrapBridge(
  options: BridgeBootstrapOptions,
): BridgeBootstrapHandle {
  const bootEvent = createBootEvent({
    sessionId: options.sessionId,
    bridgeScope: "bootstrap",
  });

  options.port.postMessage(bootEvent);

  return {
    bootEvent,
    ping() {
      const pingEvent = createPingEvent({
        sessionId: options.sessionId,
        sentAt: (options.now ?? (() => new Date()))().toISOString(),
      });

      options.port.postMessage(pingEvent);
      return pingEvent;
    },
  };
}
