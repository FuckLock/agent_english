import {
  SELECTION_EXPLANATION_COMPLETED_EVENT_TYPE,
  SELECTION_EXPLANATION_FAILED_EVENT_TYPE,
  SELECTION_REQUESTED_EVENT_TYPE,
  createBridgeEvent,
  type BridgeEvent,
  type SelectionExplanationFailurePayload,
  type SelectionExplanationResult,
  type SelectionRequestedPayload,
} from "@agent-english/contracts";

export interface SelectionEventMetadata {
  requestId?: string;
  pageId?: string;
}

export function createSelectionRequestedEvent(
  payload: SelectionRequestedPayload,
  metadata?: SelectionEventMetadata,
): BridgeEvent<typeof SELECTION_REQUESTED_EVENT_TYPE> {
  return createBridgeEvent(SELECTION_REQUESTED_EVENT_TYPE, payload, metadata);
}

export function createSelectionExplanationCompletedEvent(
  payload: SelectionExplanationResult,
  metadata?: SelectionEventMetadata,
): BridgeEvent<typeof SELECTION_EXPLANATION_COMPLETED_EVENT_TYPE> {
  return createBridgeEvent(
    SELECTION_EXPLANATION_COMPLETED_EVENT_TYPE,
    payload,
    metadata,
  );
}

export function createSelectionExplanationFailedEvent(
  payload: SelectionExplanationFailurePayload,
  metadata?: SelectionEventMetadata,
): BridgeEvent<typeof SELECTION_EXPLANATION_FAILED_EVENT_TYPE> {
  return createBridgeEvent(
    SELECTION_EXPLANATION_FAILED_EVENT_TYPE,
    payload,
    metadata,
  );
}
