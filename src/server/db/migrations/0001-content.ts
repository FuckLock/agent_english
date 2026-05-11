export const contentStatements = [
  `CREATE TABLE IF NOT EXISTS content_sources (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    origin_name TEXT,
    language TEXT NOT NULL,
    status TEXT NOT NULL,
    difficulty_level TEXT NOT NULL,
    copyright_risk TEXT NOT NULL,
    long_term_storage_risk TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS content_sources_status_idx ON content_sources (status)`,
  `CREATE INDEX IF NOT EXISTS content_sources_difficulty_idx ON content_sources (difficulty_level)`,
  `CREATE TABLE IF NOT EXISTS content_excerpts (
    id TEXT PRIMARY KEY,
    content_source_id TEXT NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
    excerpt_text TEXT NOT NULL,
    summary TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    difficulty_level TEXT NOT NULL,
    full_text_cache_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS content_excerpts_source_idx ON content_excerpts (content_source_id)`,
  `CREATE TABLE IF NOT EXISTS content_processing_jobs (
    id TEXT PRIMARY KEY,
    content_source_id TEXT NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL,
    error_summary TEXT,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS content_processing_jobs_source_idx
    ON content_processing_jobs (content_source_id)`,
  `CREATE INDEX IF NOT EXISTS content_processing_jobs_status_idx
    ON content_processing_jobs (status)`,
  `CREATE TABLE IF NOT EXISTS story_lessons (
    id TEXT PRIMARY KEY,
    content_source_id TEXT NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    level TEXT NOT NULL,
    cover_status TEXT NOT NULL,
    short_summary TEXT NOT NULL,
    full_text_folded INTEGER NOT NULL,
    lesson_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS story_lessons_source_idx ON story_lessons (content_source_id)`,
  `CREATE TABLE IF NOT EXISTS comic_panels (
    id TEXT PRIMARY KEY,
    story_lesson_id TEXT NOT NULL REFERENCES story_lessons(id) ON DELETE CASCADE,
    panel_order INTEGER NOT NULL,
    english_text TEXT NOT NULL,
    chinese_hint TEXT NOT NULL,
    image_prompt TEXT NOT NULL,
    image_status TEXT NOT NULL,
    image_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(story_lesson_id, panel_order)
  )`,
  `CREATE TABLE IF NOT EXISTS generation_jobs (
    id TEXT PRIMARY KEY,
    story_lesson_id TEXT REFERENCES story_lessons(id) ON DELETE CASCADE,
    comic_panel_id TEXT REFERENCES comic_panels(id) ON DELETE CASCADE,
    provider_config_id TEXT REFERENCES provider_configs(id) ON DELETE SET NULL,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL,
    quality TEXT NOT NULL,
    dedupe_key TEXT NOT NULL UNIQUE,
    request_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    error_summary TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS generation_jobs_status_idx ON generation_jobs (status)`
];
