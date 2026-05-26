import {
  GENERIC_SITE_CAPABILITIES,
  type SiteCapability,
  type SiteKind,
} from "@agent-english/contracts";

export interface SiteAdapterProfile {
  siteKind: SiteKind;
  capabilities: SiteCapability[];
}

export const GENERIC_SITE_PROFILE: SiteAdapterProfile = {
  siteKind: "generic",
  capabilities: [...GENERIC_SITE_CAPABILITIES],
};

export function parseAdapterURL(urlText: string): URL | null {
  try {
    return new URL(urlText);
  } catch {
    return null;
  }
}

export function hostMatches(url: URL, hosts: readonly string[]): boolean {
  const hostname = url.hostname.toLowerCase();
  return hosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

export function uniqueCapabilities(
  capabilities: readonly SiteCapability[],
): SiteCapability[] {
  return Array.from(new Set(capabilities));
}
