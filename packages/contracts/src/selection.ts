import type { SavedItem, SavedItemKind } from "./saved-item";
import type { ModelServiceErrorCode } from "./model-service";

export interface SelectionContext {
  pageId: string;
  selectionId: string;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  sourceUrl: string;
  sourceTitle: string;
  containerPath: string;
}

export interface SelectionRequestedPayload extends SelectionContext {
  kind: SavedItemKind;
}

export interface SelectionExplanationResult extends SelectionContext {
  kind: SavedItemKind;
  translation: string;
  explanation: string;
  examples: string[];
}

export const SELECTION_EXPLANATION_FAILURE_REASONS = [
  "selection-explanation-failed",
  "quota-exceeded",
  "tier-unavailable",
  "service-unavailable",
  "content-too-long",
  "provider-fallback-failed",
] as const;

export type SelectionExplanationFailureReason =
  (typeof SELECTION_EXPLANATION_FAILURE_REASONS)[number]
  | ModelServiceErrorCode;

export interface SelectionExplanationFailurePayload extends SelectionContext {
  kind: SavedItemKind;
  failureReason: SelectionExplanationFailureReason;
}

export function createSavedItemFromSelection(
  selection: SelectionExplanationResult,
  createdAt: string,
): SavedItem {
  return {
    sourceUrl: selection.sourceUrl,
    sourceTitle: selection.sourceTitle,
    selectedText: selection.selectedText,
    contextBefore: selection.contextBefore,
    contextAfter: selection.contextAfter,
    translation: selection.translation,
    explanation: selection.explanation,
    kind: selection.kind,
    createdAt,
  };
}
