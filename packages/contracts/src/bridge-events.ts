export const schemaVersion = 1 as const;

export const BRIDGE_BOOT_EVENT_TYPE = "bridge.boot" as const;
export const BRIDGE_PING_EVENT_TYPE = "bridge.ping" as const;

export type BridgeEventType =
  | typeof BRIDGE_BOOT_EVENT_TYPE
  | typeof BRIDGE_PING_EVENT_TYPE;

export interface BridgeEventError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface BridgeBootPayload {
  sessionId: string;
  bridgeScope: "bootstrap";
}

export interface BridgePingPayload {
  sessionId: string;
  sentAt: string;
}

export interface BridgePingResult {
  acknowledged: boolean;
}

interface BridgeEventPayloadMap {
  [BRIDGE_BOOT_EVENT_TYPE]: BridgeBootPayload;
  [BRIDGE_PING_EVENT_TYPE]: BridgePingPayload;
}

interface BridgeEventResultMap {
  [BRIDGE_BOOT_EVENT_TYPE]: undefined;
  [BRIDGE_PING_EVENT_TYPE]: BridgePingResult;
}

export interface BridgeEventEnvelope<
  TEventType extends BridgeEventType,
  TPayload,
  TResult,
> {
  schemaVersion: typeof schemaVersion;
  eventType: TEventType;
  payload: TPayload;
  result?: TResult;
  error?: BridgeEventError;
}

export type BridgeEvent<
  TEventType extends BridgeEventType = BridgeEventType,
> = BridgeEventEnvelope<
  TEventType,
  BridgeEventPayloadMap[TEventType],
  BridgeEventResultMap[TEventType]
>;

export function createBridgeEvent<TEventType extends BridgeEventType>(
  eventType: TEventType,
  payload: BridgeEventPayloadMap[TEventType],
  options?: {
    result?: BridgeEventResultMap[TEventType];
    error?: BridgeEventError;
  },
): BridgeEvent<TEventType> {
  return {
    schemaVersion,
    eventType,
    payload,
    result: options?.result,
    error: options?.error,
  };
}
