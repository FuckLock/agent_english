export const v16ContentStatements = [
  `ALTER TABLE comic_panels ADD COLUMN rhythm_type TEXT NOT NULL DEFAULT 'extension'`,
  `ALTER TABLE comic_panels ADD COLUMN visual_grammar_json TEXT NOT NULL DEFAULT '{}'`
];
