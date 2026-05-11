import { pathToFileURL } from "node:url";

export function nowIso() {
  return new Date().toISOString();
}

export function asJson(value: Record<string, unknown> | unknown[]) {
  return JSON.stringify(value);
}

export function isDirectRun(metaUrl: string) {
  const entry = process.argv[1];

  return Boolean(entry && pathToFileURL(entry).href === metaUrl);
}
