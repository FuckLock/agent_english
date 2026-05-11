import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const DEFAULT_DB_PATH = "data/agent-english.sqlite";

let sqlite: Database.Database | null = null;

export function getDatabasePath() {
  const configuredPath = process.env.AGENT_ENGLISH_DB_PATH ?? DEFAULT_DB_PATH;

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(/*turbopackIgnore: true*/ process.cwd(), configuredPath);
}

export function getSqlite() {
  if (sqlite) {
    return sqlite;
  }

  const databasePath = getDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  return sqlite;
}

export function getDb() {
  return drizzle(getSqlite(), { schema });
}

export function closeDb() {
  sqlite?.close();
  sqlite = null;
}
