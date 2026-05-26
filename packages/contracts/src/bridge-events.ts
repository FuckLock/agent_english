export const schemaVersion = 1 as const;

export const BRIDGE_BOOT_EVENT_TYPE = "bridge.boot" as const;
export const BRIDGE_PING_EVENT_TYPE = "bridge.ping" as const;
export const PAGE_READY_EVENT_TYPE = "page.ready" as const;
export const TRANSLATION_REQUESTED_EVENT_TYPE = "translation.requested" as const;
export const TRANSLATION_COMPLETED_EVENT_TYPE = "translation.completed" as const;
export const TRANSLATION_FAILED_EVENT_TYPE = "translation.failed" as const;
export const SELECTION_REQUESTED_EVENT_TYPE = "selection.requested" as const;
export const SELECTION_EXPLANATION_COMPLETED_EVENT_TYPE =
  "selection.explanation.completed" as const;
export const SELECTION_EXPLANATION_FAILED_EVENT_TYPE =
  "selection.explanation.failed" as const;
export const VIDEO_CAPTION_STATE_CHANGED_EVENT_TYPE =
  "video.caption.state.changed" as const;
export const VIDEO_AUDIO_STATE_CHANGED_EVENT_TYPE =
  "video.audio.state.changed" as const;
export const VIDEO_AUDIO_QUOTA_CHANGED_EVENT_TYPE =
  "video.audio.quota.changed" as const;

import type {
  TranslationFailurePayload,
  TranslationRequest,
  TranslationResult,
} from "./translation";
import type {
  SelectionExplanationFailurePayload,
  SelectionExplanationResult,
  SelectionRequestedPayload,
} from "./selection";
import type { VideoCaptionOverlayState } from "./video-caption";
import type {
  AudioTranslationQuota,
  VideoAudioTranslationState,
} from "./video-audio-translation";

export type BridgeEventType =
  | typeof BRIDGE_BOOT_EVENT_TYPE
  | typeof BRIDGE_PING_EVENT_TYPE
  | typeof PAGE_READY_EVENT_TYPE
  | typeof TRANSLATION_REQUESTED_EVENT_TYPE
  | typeof TRANSLATION_COMPLETED_EVENT_TYPE
  | typeof TRANSLATION_FAILED_EVENT_TYPE
  | typeof SELECTION_REQUESTED_EVENT_TYPE
  | typeof SELECTION_EXPLANATION_COMPLETED_EVENT_TYPE
  | typeof SELECTION_EXPLANATION_FAILED_EVENT_TYPE
  | typeof VIDEO_CAPTION_STATE_CHANGED_EVENT_TYPE
  | typeof VIDEO_AUDIO_STATE_CHANGED_EVENT_TYPE
  | typeof VIDEO_AUDIO_QUOTA_CHANGED_EVENT_TYPE;

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

export interface PageReadyPayload {
  sessionId: string;
  url: string;
  title: string;
  loadedAt: string;
}

export interface BridgePingResult {
  acknowledged: boolean;
}

interface BridgeEventPayloadMap {
  [BRIDGE_BOOT_EVENT_TYPE]: BridgeBootPayload;
  [BRIDGE_PING_EVENT_TYPE]: BridgePingPayload;
  [PAGE_READY_EVENT_TYPE]: PageReadyPayload;
  [TRANSLATION_REQUESTED_EVENT_TYPE]: TranslationRequest;
  [TRANSLATION_COMPLETED_EVENT_TYPE]: TranslationResult;
  [TRANSLATION_FAILED_EVENT_TYPE]: TranslationFailurePayload;
  [SELECTION_REQUESTED_EVENT_TYPE]: SelectionRequestedPayload;
  [SELECTION_EXPLANATION_COMPLETED_EVENT_TYPE]: SelectionExplanationResult;
  [SELECTION_EXPLANATION_FAILED_EVENT_TYPE]: SelectionExplanationFailurePayload;
  [VIDEO_CAPTION_STATE_CHANGED_EVENT_TYPE]: VideoCaptionOverlayState;
  [VIDEO_AUDIO_STATE_CHANGED_EVENT_TYPE]: VideoAudioTranslationState;
  [VIDEO_AUDIO_QUOTA_CHANGED_EVENT_TYPE]: AudioTranslationQuota;
}

interface BridgeEventResultMap {
  [BRIDGE_BOOT_EVENT_TYPE]: undefined;
  [BRIDGE_PING_EVENT_TYPE]: BridgePingResult;
  [PAGE_READY_EVENT_TYPE]: undefined;
  [TRANSLATION_REQUESTED_EVENT_TYPE]: undefined;
  [TRANSLATION_COMPLETED_EVENT_TYPE]: undefined;
  [TRANSLATION_FAILED_EVENT_TYPE]: undefined;
  [SELECTION_REQUESTED_EVENT_TYPE]: undefined;
  [SELECTION_EXPLANATION_COMPLETED_EVENT_TYPE]: undefined;
  [SELECTION_EXPLANATION_FAILED_EVENT_TYPE]: undefined;
  [VIDEO_CAPTION_STATE_CHANGED_EVENT_TYPE]: undefined;
  [VIDEO_AUDIO_STATE_CHANGED_EVENT_TYPE]: undefined;
  [VIDEO_AUDIO_QUOTA_CHANGED_EVENT_TYPE]: undefined;
}

export interface BridgeEventEnvelope<
  TEventType extends BridgeEventType,
  TPayload,
  TResult,
> {
  schemaVersion: typeof schemaVersion;
  eventType: TEventType;
  requestId?: string;
  pageId?: string;
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
    requestId?: string;
    pageId?: string;
    result?: BridgeEventResultMap[TEventType];
    error?: BridgeEventError;
  },
): BridgeEvent<TEventType> {
  return {
    schemaVersion,
    eventType,
    requestId: options?.requestId,
    pageId: options?.pageId,
    payload,
    result: options?.result,
    error: options?.error,
  };
}
