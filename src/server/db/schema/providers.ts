import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { timestamps } from "./common";

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  valueJson: text("value_json").notNull(),
  ...timestamps
});

export const providerTemplates = sqliteTable(
  "provider_templates",
  {
    id: text("id").primaryKey(),
    providerKey: text("provider_key").notNull(),
    name: text("name").notNull(),
    capability: text("capability").notNull(),
    defaultBaseUrl: text("default_base_url"),
    defaultModel: text("default_model"),
    configSchemaJson: text("config_schema_json").notNull(),
    isBuiltin: integer("is_builtin", { mode: "boolean" }).notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex("provider_templates_provider_key_unique").on(table.providerKey),
    index("provider_templates_capability_idx").on(table.capability)
  ]
);

export const providerConfigs = sqliteTable(
  "provider_configs",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => providerTemplates.id),
    displayName: text("display_name").notNull(),
    capability: text("capability").notNull(),
    baseUrl: text("base_url"),
    model: text("model"),
    apiKeySecret: text("api_key_secret"),
    apiKeyLast4: text("api_key_last4"),
    mappingJson: text("mapping_json").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    ...timestamps
  },
  (table) => [
    index("provider_configs_template_idx").on(table.templateId),
    index("provider_configs_capability_idx").on(table.capability)
  ]
);

export const providerUsageLogs = sqliteTable(
  "provider_usage_logs",
  {
    id: text("id").primaryKey(),
    providerConfigId: text("provider_config_id").references(() => providerConfigs.id, {
      onDelete: "set null"
    }),
    eventType: text("event_type").notNull(),
    status: text("status").notNull(),
    latencyMs: integer("latency_ms"),
    errorSummary: text("error_summary"),
    ...timestamps
  },
  (table) => [
    index("provider_usage_logs_config_idx").on(table.providerConfigId),
    index("provider_usage_logs_status_idx").on(table.status)
  ]
);
