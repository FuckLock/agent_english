import { getDatabasePath, getSqlite } from "./client";
import { migrations } from "./migrations";
import { isDirectRun, nowIso } from "./utils";

export function runMigrations() {
  const sqlite = getSqlite();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const hasMigration = sqlite
    .prepare("SELECT id FROM schema_migrations WHERE id = ?")
    .pluck();
  const markMigration = sqlite.prepare(
    "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)"
  );

  const applied: string[] = [];

  for (const migration of migrations) {
    if (hasMigration.get(migration.id)) {
      continue;
    }

    const applyMigration = sqlite.transaction(() => {
      sqlite.exec(migration.statements.join(";\n"));
      markMigration.run(migration.id, nowIso());
    });

    applyMigration();
    applied.push(migration.id);
  }

  return {
    applied,
    databasePath: getDatabasePath()
  };
}

if (isDirectRun(import.meta.url)) {
  const result = runMigrations();
  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        applied: result.applied,
        databasePath: result.databasePath
      },
      null,
      2
    ) + "\n"
  );
}
