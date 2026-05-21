import type { SavedItem, SavedItemKind } from "./saved-item";

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
  "provider-not-configured",
  "selection-explanation-failed",
] as const;

export type SelectionExplanationFailureReason =
  (typeof SELECTION_EXPLANATION_FAILURE_REASONS)[number];

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
