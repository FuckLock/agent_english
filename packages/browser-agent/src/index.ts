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
