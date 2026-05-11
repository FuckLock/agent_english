import { desc, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { providerConfigs, providerTemplates, providerUsageLogs } from "@/server/db/schema";
import { asJson, nowIso } from "@/server/db/utils";

type ProviderConfigInput = {
  id?: string;
  templateId: string;
  displayName: string;
  capability: string;
  baseUrl?: string | null;
  model?: string | null;
  apiKeySecret?: string | null;
  mapping?: Record<string, unknown>;
  enabled?: boolean;
};

export type ProviderConfigSafe = Omit<
  typeof providerConfigs.$inferSelect,
  "apiKeySecret" | "mappingJson"
> & {
  mapping: Record<string, unknown>;
};

function parseJsonRecord(value: string) {
  const parsed = JSON.parse(value) as unknown;

  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function toSafeConfig(row: typeof providerConfigs.$inferSelect): ProviderConfigSafe {
  const { apiKeySecret: _apiKeySecret, mappingJson, ...safeRow } = row;

  return {
    ...safeRow,
    mapping: parseJsonRecord(mappingJson)
  };
}

export function listProviderTemplates() {
  return getDb().select().from(providerTemplates).all();
}

export function listProviderConfigsSafe() {
  return getDb().select().from(providerConfigs).all().map(toSafeConfig);
}

export function saveProviderConfig(input: ProviderConfigInput) {
  const timestamp = nowIso();
  const id = input.id ?? crypto.randomUUID();
  const apiKeyLast4 = input.apiKeySecret ? input.apiKeySecret.slice(-4) : null;

  getDb()
    .insert(providerConfigs)
    .values({
      id,
      templateId: input.templateId,
      displayName: input.displayName,
      capability: input.capability,
      baseUrl: input.baseUrl ?? null,
      model: input.model ?? null,
      apiKeySecret: input.apiKeySecret ?? null,
      apiKeyLast4,
      mappingJson: asJson(input.mapping ?? {}),
      enabled: input.enabled ?? true,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: providerConfigs.id,
      set: {
        displayName: input.displayName,
        baseUrl: input.baseUrl ?? null,
        model: input.model ?? null,
        apiKeySecret: input.apiKeySecret ?? null,
        apiKeyLast4,
        mappingJson: asJson(input.mapping ?? {}),
        enabled: input.enabled ?? true,
        updatedAt: timestamp
      }
    })
    .run();

  const row = getDb().select().from(providerConfigs).where(eq(providerConfigs.id, id)).get();

  if (!row) {
    throw new Error("Provider config was not saved.");
  }

  return toSafeConfig(row);
}

export function recordProviderUsage(input: {
  providerConfigId?: string | null;
  eventType: string;
  status: string;
  latencyMs?: number | null;
  errorSummary?: string | null;
}) {
  const timestamp = nowIso();

  getDb()
    .insert(providerUsageLogs)
    .values({
      id: crypto.randomUUID(),
      providerConfigId: input.providerConfigId ?? null,
      eventType: input.eventType,
      status: input.status,
      latencyMs: input.latencyMs ?? null,
      errorSummary: input.errorSummary ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .run();
}

export function listRecentProviderUsage(limit = 20) {
  return getDb()
    .select()
    .from(providerUsageLogs)
    .orderBy(desc(providerUsageLogs.createdAt))
    .limit(limit)
    .all();
}
