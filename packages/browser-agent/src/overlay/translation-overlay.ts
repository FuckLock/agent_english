import {
  type DisplayMode,
  type TranslationFailureReason,
  type TranslationResult,
  type TranslationSegmentResult,
} from "@agent-english/contracts";

export const OVERLAY_STATUS_LABELS = {
  loading: "Translating…",
  translated: "Translation ready",
  "provider-not-configured": "Configure a provider to translate.",
  "page-unrecognized": "Select text to translate on this page.",
  "translation-failed": "Translation is unavailable right now.",
} as const;

export interface OverlayElementLike {
  textContent: string | null;
  className?: string;
  hidden?: boolean;
  title?: string;
  parentElement?: OverlayElementLike | null;
  dataset?: Record<string, string>;
  style?: Record<string, string>;
  children?: OverlayElementLike[];
  appendChild?(child: OverlayElementLike): void;
  insertAdjacentElement?(
    position: "afterend",
    child: OverlayElementLike,
  ): void;
}

export interface OverlayDocumentLike {
  createElement(tagName: string): OverlayElementLike;
}

export interface OverlaySegmentState {
  segmentId: string;
  status: "loading" | "translated" | "failed";
  translatedText?: string;
  failureReason?: TranslationFailureReason;
  displayMode: DisplayMode;
  isExpanded?: boolean;
}

export function applyOverlayState(
  documentLike: OverlayDocumentLike,
  anchorElement: OverlayElementLike,
  state: OverlaySegmentState,
): OverlayElementLike {
  const overlayElement =
    findExistingOverlay(anchorElement, state.segmentId) ??
    createOverlayElement(documentLike, anchorElement, state.segmentId);

  overlayElement.className = "agent-english-translation-overlay";
  overlayElement.dataset = {
    ...(overlayElement.dataset ?? {}),
    agentEnglishSegmentId: state.segmentId,
    agentEnglishStatus: state.status,
  };
  overlayElement.textContent = messageForState(state);
  overlayElement.title = state.status === "failed" ? messageForState(state) : "";
  overlayElement.hidden = shouldHideOverlay(
    state.displayMode,
    state.segmentId,
    state.isExpanded ?? false,
  );

  const style = overlayElement.style ?? {};
  style.marginTop = "8px";
  style.fontSize = "0.92em";
  style.lineHeight = "1.5";
  style.color = state.status === "failed" ? "#b45309" : "#475569";
  overlayElement.style = style;

  return overlayElement;
}

export function applyTranslationResult(
  documentLike: OverlayDocumentLike,
  anchorsBySegmentId: Record<string, OverlayElementLike>,
  translationResult: TranslationResult,
  expandedSegmentIds: ReadonlySet<string> = new Set(),
): OverlayElementLike[] {
  return translationResult.segmentResults
    .map((segmentResult) => {
      const anchorElement = anchorsBySegmentId[segmentResult.segmentId];
      if (!anchorElement) {
        return null;
      }

      return applyOverlayState(documentLike, anchorElement, {
        segmentId: segmentResult.segmentId,
        status: segmentResult.failureReason ? "failed" : "translated",
        translatedText: segmentResult.translatedText,
        failureReason: segmentResult.failureReason,
        displayMode: translationResult.displayMode,
        isExpanded: expandedSegmentIds.has(segmentResult.segmentId),
      });
    })
    .filter((overlayElement): overlayElement is OverlayElementLike => Boolean(overlayElement));
}

export function messageForFailure(
  failureReason: TranslationFailureReason | undefined,
): string {
  if (!failureReason) {
    return OVERLAY_STATUS_LABELS["translation-failed"];
  }

  return OVERLAY_STATUS_LABELS[failureReason];
}

function messageForState(state: OverlaySegmentState): string {
  if (state.status === "loading") {
    return OVERLAY_STATUS_LABELS.loading;
  }

  if (state.status === "failed") {
    return messageForFailure(state.failureReason);
  }

  return state.translatedText ?? OVERLAY_STATUS_LABELS.translated;
}

function shouldHideOverlay(
  displayMode: DisplayMode,
  segmentId: string,
  isExpanded: boolean,
): boolean {
  if (displayMode === "original") {
    return true;
  }

  if (displayMode === "learning") {
    return !isExpanded && segmentId.length > 0;
  }

  return false;
}

function createOverlayElement(
  documentLike: OverlayDocumentLike,
  anchorElement: OverlayElementLike,
  segmentId: string,
): OverlayElementLike {
  const overlayElement = documentLike.createElement("div");
  overlayElement.dataset = {
    ...(overlayElement.dataset ?? {}),
    agentEnglishSegmentId: segmentId,
  };

  if (anchorElement.insertAdjacentElement) {
    anchorElement.insertAdjacentElement("afterend", overlayElement);
  } else if (anchorElement.parentElement?.appendChild) {
    anchorElement.parentElement.appendChild(overlayElement);
  } else {
    const siblings = anchorElement.parentElement?.children;
    if (siblings) {
      siblings.push(overlayElement);
    }
  }

  overlayElement.parentElement = anchorElement.parentElement ?? null;
  return overlayElement;
}

function findExistingOverlay(
  anchorElement: OverlayElementLike,
  segmentId: string,
): OverlayElementLike | null {
  const siblings = anchorElement.parentElement?.children ?? [];
  return (
    siblings.find(
      (sibling) => sibling.dataset?.agentEnglishSegmentId === segmentId,
    ) ?? null
  );
}
