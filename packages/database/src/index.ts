import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createDatabase(path: string) {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  // Run migrations automatically
  const migrationsFolder = join(__dirname, "migrations");
  migrate(db, { migrationsFolder });

  return db;
}

export * from "./schema.js";
export type Database = ReturnType<typeof createDatabase>;
