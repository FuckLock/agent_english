import {
  GENERIC_SITE_CAPABILITIES,
  type SiteCapability,
} from "@agent-english/contracts";
import { hostMatches, parseAdapterURL, uniqueCapabilities } from "./generic";

export const X_SITE_CAPABILITIES = uniqueCapabilities([
  ...GENERIC_SITE_CAPABILITIES,
  "dynamic-content",
] satisfies readonly SiteCapability[]);

export function isXURL(urlText: string): boolean {
  const url = parseAdapterURL(urlText);
  return Boolean(url && hostMatches(url, ["x.com", "twitter.com"]));
}
