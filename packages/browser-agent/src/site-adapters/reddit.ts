import {
  GENERIC_SITE_CAPABILITIES,
  type SiteCapability,
} from "@agent-english/contracts";
import { hostMatches, parseAdapterURL, uniqueCapabilities } from "./generic";

export const REDDIT_SITE_CAPABILITIES = uniqueCapabilities([
  ...GENERIC_SITE_CAPABILITIES,
  "comments",
  "dynamic-content",
] satisfies readonly SiteCapability[]);

export function isRedditURL(urlText: string): boolean {
  const url = parseAdapterURL(urlText);
  return Boolean(url && hostMatches(url, ["reddit.com"]));
}
