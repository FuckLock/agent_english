import {
  GENERIC_SITE_CAPABILITIES,
  type SiteCapability,
} from "@agent-english/contracts";
import { hostMatches, parseAdapterURL, uniqueCapabilities } from "./generic";

export const WIKIPEDIA_SITE_CAPABILITIES = uniqueCapabilities([
  ...GENERIC_SITE_CAPABILITIES,
  "longform-reading",
] satisfies readonly SiteCapability[]);

export function isWikipediaURL(urlText: string): boolean {
  const url = parseAdapterURL(urlText);
  return Boolean(url && hostMatches(url, ["wikipedia.org"]));
}
