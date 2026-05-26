import {
  GENERIC_SITE_CAPABILITIES,
  type SiteCapability,
} from "@agent-english/contracts";
import { AO3_SITE_CAPABILITIES, isAO3URL } from "./ao3";
import { GENERIC_SITE_PROFILE, type SiteAdapterProfile } from "./generic";
import { REDDIT_SITE_CAPABILITIES, isRedditURL } from "./reddit";
import { WIKIPEDIA_SITE_CAPABILITIES, isWikipediaURL } from "./wikipedia";
import { X_SITE_CAPABILITIES, isXURL } from "./x";
import { detectYouTubePage, youtubePageCapabilities } from "./youtube";

export { AO3_SITE_CAPABILITIES, isAO3URL } from "./ao3";
export {
  GENERIC_SITE_PROFILE,
  hostMatches,
  parseAdapterURL,
  uniqueCapabilities,
  type SiteAdapterProfile,
} from "./generic";
export { REDDIT_SITE_CAPABILITIES, isRedditURL } from "./reddit";
export { WIKIPEDIA_SITE_CAPABILITIES, isWikipediaURL } from "./wikipedia";
export { X_SITE_CAPABILITIES, isXURL } from "./x";

export function detectSiteAdapter(urlText: string): SiteAdapterProfile {
  const youtube = detectYouTubePage(urlText);
  if (youtube.isYouTube) {
    return {
      siteKind: "youtube",
      capabilities: youtubePageCapabilities(urlText),
    };
  }

  if (isRedditURL(urlText)) {
    return {
      siteKind: "reddit",
      capabilities: [...REDDIT_SITE_CAPABILITIES],
    };
  }

  if (isWikipediaURL(urlText)) {
    return {
      siteKind: "wikipedia",
      capabilities: [...WIKIPEDIA_SITE_CAPABILITIES],
    };
  }

  if (isAO3URL(urlText)) {
    return {
      siteKind: "ao3",
      capabilities: [...AO3_SITE_CAPABILITIES],
    };
  }

  if (isXURL(urlText)) {
    return {
      siteKind: "x",
      capabilities: [...X_SITE_CAPABILITIES],
    };
  }

  return {
    siteKind: GENERIC_SITE_PROFILE.siteKind,
    capabilities: [...(GENERIC_SITE_CAPABILITIES as readonly SiteCapability[])],
  };
}
