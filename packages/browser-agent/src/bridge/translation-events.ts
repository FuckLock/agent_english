import {
  TRANSLATION_COMPLETED_EVENT_TYPE,
  TRANSLATION_FAILED_EVENT_TYPE,
  TRANSLATION_REQUESTED_EVENT_TYPE,
  createBridgeEvent,
  type BridgeEvent,
  type TranslationFailurePayload,
  type TranslationRequest,
  type TranslationResult,
} from "@agent-english/contracts";

export interface TranslationEventMetadata {
  requestId?: string;
  pageId?: string;
}

export function createTranslationRequestedEvent(
  payload: TranslationRequest,
  metadata?: TranslationEventMetadata,
): BridgeEvent<typeof TRANSLATION_REQUESTED_EVENT_TYPE> {
  return createBridgeEvent(TRANSLATION_REQUESTED_EVENT_TYPE, payload, metadata);
}

export function createTranslationCompletedEvent(
  payload: TranslationResult,
  metadata?: TranslationEventMetadata,
): BridgeEvent<typeof TRANSLATION_COMPLETED_EVENT_TYPE> {
  return createBridgeEvent(TRANSLATION_COMPLETED_EVENT_TYPE, payload, metadata);
}

export function createTranslationFailedEvent(
  payload: TranslationFailurePayload,
  metadata?: TranslationEventMetadata,
): BridgeEvent<typeof TRANSLATION_FAILED_EVENT_TYPE> {
  return createBridgeEvent(TRANSLATION_FAILED_EVENT_TYPE, payload, metadata);
}
