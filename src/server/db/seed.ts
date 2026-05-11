import { eq } from "drizzle-orm";

import { getDatabasePath, getDb } from "./client";
import { runMigrations } from "./migrate";
import { applyProviderTemplates, applyLessons } from "./seed-content";
import { applyDemoBattle, applyProgress } from "./seed-game";
import { dungeons, providerTemplates, userProgress } from "./schema";
import { isDirectRun, nowIso } from "./utils";

export function seedDatabase() {
  runMigrations();

  const timestamp = nowIso();
  applyProviderTemplates(timestamp);
  applyLessons(timestamp);
  applyDemoBattle(timestamp);
  applyProgress(timestamp);

  const db = getDb();
  const dungeonCount = db.select().from(dungeons).all().length;
  const templateCount = db.select().from(providerTemplates).all().length;
  const progress = db
    .select()
    .from(userProgress)
    .where(eq(userProgress.userId, "local-user"))
    .get();

  return {
    databasePath: getDatabasePath(),
    dungeonCount,
    templateCount,
    userXp: progress?.xp ?? 0
  };
}

if (isDirectRun(import.meta.url)) {
  process.stdout.write(JSON.stringify({ ok: true, ...seedDatabase() }, null, 2) + "\n");
}
