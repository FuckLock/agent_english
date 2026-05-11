export const providerStatements = [
  `CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS provider_templates (
    id TEXT PRIMARY KEY,
    provider_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    capability TEXT NOT NULL,
    default_base_url TEXT,
    default_model TEXT,
    config_schema_json TEXT NOT NULL,
    is_builtin INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS provider_templates_capability_idx
    ON provider_templates (capability)`,
  `CREATE TABLE IF NOT EXISTS provider_configs (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES provider_templates(id),
    display_name TEXT NOT NULL,
    capability TEXT NOT NULL,
    base_url TEXT,
    model TEXT,
    api_key_secret TEXT,
    api_key_last4 TEXT,
    mapping_json TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS provider_configs_template_idx
    ON provider_configs (template_id)`,
  `CREATE INDEX IF NOT EXISTS provider_configs_capability_idx
    ON provider_configs (capability)`,
  `CREATE TABLE IF NOT EXISTS provider_usage_logs (
    id TEXT PRIMARY KEY,
    provider_config_id TEXT REFERENCES provider_configs(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    latency_ms INTEGER,
    error_summary TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS provider_usage_logs_config_idx
    ON provider_usage_logs (provider_config_id)`,
  `CREATE INDEX IF NOT EXISTS provider_usage_logs_status_idx
    ON provider_usage_logs (status)`
];
