export {
  bootstrapBridge,
  createBootEvent,
  createPageReadyEvent,
  createPingEvent,
  type BridgeBootstrapHandle,
  type BridgeBootstrapOptions,
  type BridgeBootstrapPort,
} from "./bridge/bootstrap";
export {
  createSelectionExplanationCompletedEvent,
  createSelectionExplanationFailedEvent,
  createSelectionRequestedEvent,
  type SelectionEventMetadata,
} from "./bridge/selection-events";
export {
  deriveSelectionKind,
  extractSelectionContext,
  type ExtractSelectionOptions,
  type SelectionDocumentLike,
  type SelectionElementLike,
  type SelectionLike,
  type SelectionNodeLike,
  type SelectionRangeLike,
} from "./dom/selection-context";
export {
  createTranslationCompletedEvent,
  createTranslationFailedEvent,
  createTranslationRequestedEvent,
  type TranslationEventMetadata,
} from "./bridge/translation-events";
export {
  createPageContext,
  deriveStableSegmentId,
  normalizeSegmentText,
  scanPageSegments,
  type ScanPageOptions,
  type ScanPageResult,
  type ScannerDocument,
  type ScannerElement,
  type ScannerTextNode,
} from "./dom/segment-scanner";
export {
  applyOverlayState,
  applyTranslationResult,
  messageForFailure,
  OVERLAY_STATUS_LABELS,
  type OverlayDocumentLike,
  type OverlayElementLike,
  type OverlaySegmentState,
} from "./overlay/translation-overlay";
export {
  DISPLAY_MODE_LABELS,
  DisplayModeController,
} from "./modes/display-mode-controller";
export { BROWSER_AGENT_RUNTIME_SOURCE } from "./browser-runtime-source";
