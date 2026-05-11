import { desc, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { providerConfigs, providerTemplates, providerUsageLogs } from "@/server/db/schema";
import { asJson, nowIso } from "@/server/db/utils";
import {
  builtinProviderTemplates,
  getTemplateDefinition,
  type ProviderCapability,
  serializeTemplateSchema
} from "@/server/providers/provider-templates";

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

export type ProviderSetupStatus = {
  hasTextProvider: boolean;
  hasImageProvider: boolean;
  hasTtsProvider: boolean;
  hasSearchProvider: boolean;
  manualInputAvailable: boolean;
  canStartFormalLearning: boolean;
  imageMode: "image" | "text-card";
  searchMode: "search" | "manual";
};

export type ProviderTemplateSafe = Omit<typeof providerTemplates.$inferSelect, "capability"> & {
  capability: ProviderCapability;
};

const providerCapabilities = new Set<ProviderCapability>([
  "text",
  "image",
  "tts",
  "stt",
  "search",
  "data"
]);

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

function toSafeTemplate(row: typeof providerTemplates.$inferSelect): ProviderTemplateSafe {
  const capability = providerCapabilities.has(row.capability as ProviderCapability)
    ? (row.capability as ProviderCapability)
    : "data";

  return { ...row, capability };
}

function isConfigReady(config: ProviderConfigSafe) {
  const template = getTemplateDefinition(config.templateId);
  if (!template) {
    return false;
  }

  if (template.requiresApiKey && !config.apiKeyLast4) {
    return false;
  }

  return template.capability === "data" || Boolean(config.baseUrl ?? template.defaultBaseUrl);
}

export function listProviderTemplates() {
  syncBuiltinProviderTemplates();

  return getDb().select().from(providerTemplates).all().map(toSafeTemplate);
}

export function listProviderConfigsSafe() {
  return getDb().select().from(providerConfigs).all().map(toSafeConfig);
}

export function getProviderConfigUnsafe(id: string) {
  return getDb().select().from(providerConfigs).where(eq(providerConfigs.id, id)).get() ?? null;
}

export function saveProviderConfig(input: ProviderConfigInput) {
  const timestamp = nowIso();
  const id = input.id ?? crypto.randomUUID();
  const existing = input.id ? getProviderConfigUnsafe(input.id) : null;
  const apiKeySecret =
    input.apiKeySecret === undefined ? existing?.apiKeySecret ?? null : input.apiKeySecret || null;
  const apiKeyLast4 = apiKeySecret ? apiKeySecret.slice(-4) : null;

  getDb()
    .insert(providerConfigs)
    .values({
      id,
      templateId: input.templateId,
      displayName: input.displayName,
      capability: input.capability,
      baseUrl: input.baseUrl ?? null,
      model: input.model ?? null,
      apiKeySecret,
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
        capability: input.capability,
        baseUrl: input.baseUrl ?? null,
        model: input.model ?? null,
        apiKeySecret,
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

export function deleteProviderConfig(id: string) {
  getDb().delete(providerConfigs).where(eq(providerConfigs.id, id)).run();
}

export function getProviderSetupStatus(): ProviderSetupStatus {
  const configs = listProviderConfigsSafe().filter((config) => config.enabled && isConfigReady(config));
  const hasTextProvider = configs.some((config) => config.capability === "text");
  const hasImageProvider = configs.some((config) => config.capability === "image");
  const hasTtsProvider = configs.some((config) => config.capability === "tts");
  const hasSearchProvider = configs.some((config) => config.capability === "search");

  return {
    hasTextProvider,
    hasImageProvider,
    hasTtsProvider,
    hasSearchProvider,
    manualInputAvailable: true,
    canStartFormalLearning: hasTextProvider,
    imageMode: hasImageProvider ? "image" : "text-card",
    searchMode: hasSearchProvider ? "search" : "manual"
  };
}

export function getReadyProviderConfigId(capability: ProviderCapability) {
  return (
    listProviderConfigsSafe().find(
      (config) => config.enabled && config.capability === capability && isConfigReady(config)
    )?.id ?? null
  );
}

export function getProviderSettingsData() {
  return {
    templates: listProviderTemplates(),
    configs: listProviderConfigsSafe(),
    status: getProviderSetupStatus(),
    recentUsage: listRecentProviderUsage(8)
  };
}

export function syncBuiltinProviderTemplates() {
  const timestamp = nowIso();
  const db = getDb();

  for (const template of builtinProviderTemplates) {
    db.insert(providerTemplates)
      .values({
        id: template.id,
        providerKey: template.providerKey,
        name: template.name,
        capability: template.capability,
        defaultBaseUrl: template.defaultBaseUrl,
        defaultModel: template.defaultModel,
        configSchemaJson: serializeTemplateSchema(template),
        isBuiltin: true,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoUpdate({
        target: providerTemplates.id,
        set: {
          name: template.name,
          capability: template.capability,
          defaultBaseUrl: template.defaultBaseUrl,
          defaultModel: template.defaultModel,
          configSchemaJson: serializeTemplateSchema(template),
          updatedAt: timestamp
        }
      })
      .run();
  }
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
