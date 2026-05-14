import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { timestamps } from "./common";
import { providerConfigs } from "./providers";

export const contentSources = sqliteTable(
  "content_sources",
  {
    id: text("id").primaryKey(),
    sourceType: text("source_type").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    originName: text("origin_name"),
    language: text("language").notNull(),
    status: text("status").notNull(),
    difficultyLevel: text("difficulty_level").notNull(),
    copyrightRisk: text("copyright_risk").notNull(),
    longTermStorageRisk: text("long_term_storage_risk").notNull(),
    metadataJson: text("metadata_json").notNull(),
    ...timestamps
  },
  (table) => [
    index("content_sources_status_idx").on(table.status),
    index("content_sources_difficulty_idx").on(table.difficultyLevel)
  ]
);

export const contentExcerpts = sqliteTable(
  "content_excerpts",
  {
    id: text("id").primaryKey(),
    contentSourceId: text("content_source_id")
      .notNull()
      .references(() => contentSources.id, { onDelete: "cascade" }),
    excerptText: text("excerpt_text").notNull(),
    summary: text("summary").notNull(),
    wordCount: integer("word_count").notNull(),
    difficultyLevel: text("difficulty_level").notNull(),
    fullTextCacheStatus: text("full_text_cache_status").notNull(),
    ...timestamps
  },
  (table) => [index("content_excerpts_source_idx").on(table.contentSourceId)]
);

export const contentProcessingJobs = sqliteTable(
  "content_processing_jobs",
  {
    id: text("id").primaryKey(),
    contentSourceId: text("content_source_id")
      .notNull()
      .references(() => contentSources.id, { onDelete: "cascade" }),
    jobType: text("job_type").notNull(),
    status: text("status").notNull(),
    errorSummary: text("error_summary"),
    resultJson: text("result_json").notNull(),
    ...timestamps
  },
  (table) => [
    index("content_processing_jobs_source_idx").on(table.contentSourceId),
    index("content_processing_jobs_status_idx").on(table.status)
  ]
);

export const storyLessons = sqliteTable(
  "story_lessons",
  {
    id: text("id").primaryKey(),
    contentSourceId: text("content_source_id")
      .notNull()
      .references(() => contentSources.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    level: text("level").notNull(),
    coverStatus: text("cover_status").notNull(),
    shortSummary: text("short_summary").notNull(),
    fullTextFolded: integer("full_text_folded", { mode: "boolean" }).notNull(),
    lessonJson: text("lesson_json").notNull(),
    ...timestamps
  },
  (table) => [index("story_lessons_source_idx").on(table.contentSourceId)]
);

export const comicPanels = sqliteTable(
  "comic_panels",
  {
    id: text("id").primaryKey(),
    storyLessonId: text("story_lesson_id")
      .notNull()
      .references(() => storyLessons.id, { onDelete: "cascade" }),
    panelOrder: integer("panel_order").notNull(),
    englishText: text("english_text").notNull(),
    chineseHint: text("chinese_hint").notNull(),
    imagePrompt: text("image_prompt").notNull(),
    imageStatus: text("image_status").notNull(),
    imageUrl: text("image_url"),
    rhythmType: text("rhythm_type").notNull(),
    visualGrammarJson: text("visual_grammar_json").notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex("comic_panels_lesson_order_unique").on(table.storyLessonId, table.panelOrder)
  ]
);

export const generationJobs = sqliteTable(
  "generation_jobs",
  {
    id: text("id").primaryKey(),
    storyLessonId: text("story_lesson_id").references(() => storyLessons.id, {
      onDelete: "cascade"
    }),
    comicPanelId: text("comic_panel_id").references(() => comicPanels.id, {
      onDelete: "cascade"
    }),
    providerConfigId: text("provider_config_id").references(() => providerConfigs.id, {
      onDelete: "set null"
    }),
    jobType: text("job_type").notNull(),
    status: text("status").notNull(),
    quality: text("quality").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    requestJson: text("request_json").notNull(),
    resultJson: text("result_json").notNull(),
    errorSummary: text("error_summary"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("generation_jobs_dedupe_key_unique").on(table.dedupeKey),
    index("generation_jobs_status_idx").on(table.status)
  ]
);
