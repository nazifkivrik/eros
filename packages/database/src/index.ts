import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export async function createDatabase(path: string) {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  // Run migrations automatically
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = join(__dirname, "migrations");

  try {
    await migrate(db, { migrationsFolder });
    console.log("✅ Database migrations completed successfully");
  } catch (error) {
    console.error("❌ Database migration failed:", error);
    throw error;
  }

  return db;
}

export * from "./schema.js";
// Use Awaited to unwrap the Promise from the async function's return type
export type Database = Awaited<ReturnType<typeof createDatabase>>;
export type DatabaseInstance = Database;
