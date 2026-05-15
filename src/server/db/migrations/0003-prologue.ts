export const prologueStatements = [
  `ALTER TABLE dungeons ADD COLUMN is_prologue INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS dungeons_is_prologue_idx ON dungeons (is_prologue)`
];
