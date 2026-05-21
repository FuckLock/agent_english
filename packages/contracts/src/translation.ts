export const DISPLAY_MODES = [
  "original",
  "bilingual",
  "learning",
] as const;

export type DisplayMode = (typeof DISPLAY_MODES)[number];

export const SITE_CAPABILITIES = [
  "readable-page",
  "inline-translation",
  "selection-fallback",
] as const;

export type SiteCapability = (typeof SITE_CAPABILITIES)[number];

export const TRANSLATION_FAILURE_REASONS = [
  "provider-not-configured",
  "page-unrecognized",
  "translation-failed",
] as const;

export type TranslationFailureReason =
  (typeof TRANSLATION_FAILURE_REASONS)[number];

export interface PageContext {
  pageId: string;
  url: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  displayMode: DisplayMode;
  capabilities: SiteCapability[];
  siteKind: "generic";
}

export interface PageTextSegment {
  pageId: string;
  segmentId: string;
  sourceText: string;
  containerPath: string;
  sourceLanguage: string;
  isVisible: boolean;
  capabilities: SiteCapability[];
}

export interface TranslationRequest {
  pageId: string;
  pageContext: PageContext;
  sourceLanguage: string;
  targetLanguage: string;
  displayMode: DisplayMode;
  capabilities: SiteCapability[];
  segments: PageTextSegment[];
}

export interface TranslationSegmentResult {
  segmentId: string;
  translatedText?: string;
  failureReason?: TranslationFailureReason;
}

export interface TranslationResult {
  pageId: string;
  sourceLanguage: string;
  targetLanguage: string;
  displayMode: DisplayMode;
  capabilities: SiteCapability[];
  segmentResults: TranslationSegmentResult[];
  resultsBySegmentId: Record<string, TranslationSegmentResult>;
  failureReason?: TranslationFailureReason;
}

export interface TranslationFailurePayload {
  pageId: string;
  segmentId?: string;
  sourceLanguage: string;
  targetLanguage: string;
  displayMode: DisplayMode;
  capabilities: SiteCapability[];
  failureReason: TranslationFailureReason;
}

export function createTranslationResultMap(
  segmentResults: TranslationSegmentResult[],
): Record<string, TranslationSegmentResult> {
  return segmentResults.reduce<Record<string, TranslationSegmentResult>>(
    (map, segmentResult) => {
      map[segmentResult.segmentId] = segmentResult;
      return map;
    },
    {},
  );
}

export function createTranslationResult(
  result: Omit<TranslationResult, "resultsBySegmentId">,
): TranslationResult {
  return {
    ...result,
    resultsBySegmentId: createTranslationResultMap(result.segmentResults),
  };
}
