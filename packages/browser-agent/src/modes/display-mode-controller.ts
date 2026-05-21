import {
  DISPLAY_MODES,
  type DisplayMode,
} from "@agent-english/contracts";

export const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  original: "Original",
  bilingual: "Bilingual",
  learning: "Learning",
};

export class DisplayModeController {
  private displayMode: DisplayMode;

  private readonly expandedSegmentIds = new Set<string>();

  constructor(initialMode: DisplayMode = "original") {
    this.displayMode = initialMode;
  }

  get currentMode(): DisplayMode {
    return this.displayMode;
  }

  setMode(mode: DisplayMode): DisplayMode {
    if (!DISPLAY_MODES.includes(mode)) {
      return this.displayMode;
    }

    this.displayMode = mode;
    if (mode !== "learning") {
      this.expandedSegmentIds.clear();
    }

    return this.displayMode;
  }

  toggleSegment(segmentId: string): boolean {
    if (this.displayMode !== "learning") {
      return false;
    }

    if (this.expandedSegmentIds.has(segmentId)) {
      this.expandedSegmentIds.delete(segmentId);
      return false;
    }

    this.expandedSegmentIds.add(segmentId);
    return true;
  }

  isTranslationVisible(segmentId: string): boolean {
    if (this.displayMode === "original") {
      return false;
    }

    if (this.displayMode === "bilingual") {
      return true;
    }

    return this.expandedSegmentIds.has(segmentId);
  }

  isSegmentCollapsed(segmentId: string): boolean {
    return this.displayMode === "learning" && !this.expandedSegmentIds.has(segmentId);
  }
}
