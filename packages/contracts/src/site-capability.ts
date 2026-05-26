export const SITE_KINDS = [
  "generic",
  "youtube",
  "reddit",
  "wikipedia",
  "ao3",
  "x",
] as const;

export type SiteKind = (typeof SITE_KINDS)[number];

export const SITE_CAPABILITIES = [
  "readable-page",
  "inline-translation",
  "selection-fallback",
  "comments",
  "search-results",
  "longform-reading",
  "dynamic-content",
  "captions-available",
  "captions-unavailable",
  "video-caption-overlay",
  "video-caption-fallback",
  "audio-translation-beta",
  "video-audio-translation",
  "video-audio-unavailable",
] as const;

export type SiteCapability = (typeof SITE_CAPABILITIES)[number];

export const GENERIC_SITE_CAPABILITIES = [
  "readable-page",
  "inline-translation",
  "selection-fallback",
] as const satisfies readonly SiteCapability[];

export const CORE_SITE_KINDS = SITE_KINDS.filter(
  (siteKind): siteKind is Exclude<SiteKind, "generic"> => siteKind !== "generic",
);
