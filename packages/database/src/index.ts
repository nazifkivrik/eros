import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readdirSync, readFileSync, existsSync } from "fs";

/**
 * Run pending migrations automatically on database startup
 * Custom migration system for SQLite that tracks executed migrations
 */
export async function createDatabase(path: string) {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  // Create migrations tracking table if it doesn't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _eros_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Run pending migrations
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = join(__dirname, "migrations");
  const migrationsFolderDist = join(__dirname, "..", "dist", "migrations");

  // Find the migrations folder (src or dist)
  const actualMigrationsFolder = existsSync(migrationsFolder)
    ? migrationsFolder
    : migrationsFolderDist;

  if (!existsSync(actualMigrationsFolder)) {
    console.log("⚠️  No migrations folder found, skipping migrations");
    return db;
  }

  // Get all migration files sorted by name
  const migrationFiles = readdirSync(actualMigrationsFolder)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Check if database is empty (no tables except migrations)
  const tables = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_eros_%'"
    )
    .all() as any[];
  const isEmptyDatabase = tables.length === 0;

  // Get executed migrations
  const executedMigrations = sqlite
    .prepare("SELECT name FROM _eros_migrations")
    .all()
    .map((row: any) => row.name as string);

  // Helper function to check if a table exists
  const tableExists = (tableName: string): boolean => {
    const result = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(tableName) as any;
    return !!result;
  };

  // Helper function to check if a column exists in a table
  const columnExists = (tableName: string, columnName: string): boolean => {
    if (!tableExists(tableName)) return false;
    const result = sqlite
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as any[];
    return result.some((col: any) => col.name === columnName);
  };

  // Helper function to check if an index exists
  const indexExists = (indexName: string): boolean => {
    const result = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?")
      .get(indexName) as any;
    return !!result;
  };

  // Migration signature mapping - what each migration creates
  // Used to detect already-applied migrations
  const migrationSignatures: Record<
    string,
    {
      tables?: string[];
      columns?: Record<string, string[]>;
      columnsAbsent?: Record<string, string[]>; // Columns that should NOT exist after migration
      indexes?: string[]; // Indexes created by this migration
    }
  > = {
    "0000_supreme_marrow": {
      tables: [
        "scenes",
        "performers",
        "studios",
        "tags",
        "scene_files",
        "subscriptions",
        "download_queue",
        "app_settings",
      ],
    },
    "0001_silent_excalibur": {
      tables: ["ai_match_scores"],
    },
    "0002_add_cross_encoder_settings": {
      columns: {
        settings: ["crossEncoderThreshold", "crossEncoderModel"],
      },
    },
    "0003_refine_subscription_status": {
      // This migration REMOVES the 'monitored' column
      // We detect it by checking that monitored does NOT exist
      columnsAbsent: {
        subscriptions: ["monitored"],
      },
    },
    "0004_replace_status_with_issubscribed": {
      // This migration removes status/last_check_at/error_message and adds is_subscribed
      columns: {
        subscriptions: ["is_subscribed"],
      },
      columnsAbsent: {
        subscriptions: ["status", "last_check_at", "error_message"],
      },
    },
    "0005_add_torrent_retry_fields": {
      columns: {
        download_queue: [
          "add_to_client_attempts",
          "add_to_client_last_attempt",
          "add_to_client_error",
        ],
      },
    },
    "0006_purple_scrambler": {
      columns: {
        scenes: ["is_subscribed"], // Correct - matches actual SQL: ALTER TABLE `scenes` ADD `is_subscribed`
      },
    },
    "0007_fast_lifeguard": {
      columns: {
        download_queue: [
          "auto_management_paused",
          "auto_pause_reason",
          "auto_pause_count",
          "last_auto_pause_at",
          "last_activity_at",
        ],
      },
    },
    "0008_schema_improvements": {
      indexes: [
        "performers_slug_idx",
        "studios_slug_idx",
        "scenes_slug_idx",
        "directors_slug_idx",
        "tags_slug_idx",
        "scenes_is_subscribed_idx",
        "scenes_discovery_group_id_idx",
      ],
    },
  };

  // Detect already-applied migrations for existing databases
  // Run for ALL non-empty databases, not just when executedMigrations.length === 0
  if (!isEmptyDatabase) {
    console.log(
      "📋 Detecting already-applied migrations for existing database..."
    );

    for (const file of migrationFiles) {
      const migrationName = file.replace(".sql", "");
      const signature = migrationSignatures[migrationName];

      // Skip if already tracked as executed
      if (executedMigrations.includes(migrationName)) {
        continue;
      }

      // Skip if no signature defined (unknown migration)
      if (!signature) {
        console.log(
          `  ⚠️  No signature defined for ${migrationName}, skipping detection`
        );
        continue;
      }

      let alreadyApplied = false;

      // Check if tables exist
      if (signature.tables) {
        const allTablesExist = signature.tables.every((t) => tableExists(t));
        if (allTablesExist) {
          alreadyApplied = true;
        }
      }

      // Check if columns exist
      if (signature.columns && !alreadyApplied) {
        let allColumnsExist = true;
        for (const [table, columns] of Object.entries(signature.columns)) {
          for (const col of columns) {
            if (!columnExists(table, col)) {
              allColumnsExist = false;
              break;
            }
          }
        }
        if (allColumnsExist) {
          alreadyApplied = true;
        }
      }

      // Check if columns that should be absent are actually absent
      if (signature.columnsAbsent) {
        let allColumnsAbsent = true;
        for (const [table, columns] of Object.entries(
          signature.columnsAbsent
        )) {
          for (const col of columns) {
            if (columnExists(table, col)) {
              allColumnsAbsent = false;
              break;
            }
          }
        }

        // If this migration only has columnsAbsent (no other conditions), use that as only check
        if (!signature.tables && !signature.columns && allColumnsAbsent) {
          alreadyApplied = true;
        } else if (alreadyApplied && !allColumnsAbsent) {
          // If other conditions passed but columns that should be absent are present, not applied
          alreadyApplied = false;
        }
      }

      // Check if indexes exist
      if (signature.indexes && !alreadyApplied) {
        const allIndexesExist = signature.indexes.every((idx) =>
          indexExists(idx)
        );
        if (allIndexesExist) {
          alreadyApplied = true;
        }
      }

      if (alreadyApplied) {
        sqlite
          .prepare("INSERT OR IGNORE INTO _eros_migrations (name) VALUES (?)")
          .run(migrationName);
        executedMigrations.push(migrationName);
        console.log(
          `✓ Detected and tracked existing migration: ${migrationName}`
        );
      }
    }
  }

  // Run pending migrations
  for (const file of migrationFiles) {
    const migrationName = file.replace(".sql", "");

    // Skip if already executed
    if (executedMigrations.includes(migrationName)) {
      continue;
    }

    // Run the migration
    console.log(`🔄 Running migration: ${migrationName}`);

    const migrationSQL = readFileSync(
      join(actualMigrationsFolder, file),
      "utf-8"
    );
    const statements = migrationSQL.split("--> statement-breakpoint");

    // Special handling for migration 0003: check if status column exists before UPDATE
    if (migrationName === "0003_refine_subscription_status") {
      const firstStatement = statements[0]?.trim();
      if (
        firstStatement &&
        firstStatement
          .toUpperCase()
          .startsWith("UPDATE subscriptions SET status")
      ) {
        if (!columnExists("subscriptions", "status")) {
          console.log(
            `  ⚠️  Skipping UPDATE statement (status column doesn't exist)`
          );
          statements.shift(); // Remove first statement
        }
      }
    }

    try {
      let executedAnyStatement = false;
      let failedStatements = 0;

      for (const statement of statements) {
        const trimmed = statement.trim();
        if (!trimmed) continue;

        try {
          sqlite.exec(trimmed);
          executedAnyStatement = true;
        } catch (stmtError: any) {
          const stmtErrorMessage = stmtError?.message || String(stmtError);

          // If statement fails due to missing column/table/duplicate, skip it
          // This handles databases in intermediate states
          if (
            stmtErrorMessage.includes("no such column") ||
            stmtErrorMessage.includes("no such table") ||
            stmtErrorMessage.includes("duplicate column") ||
            (stmtErrorMessage.includes("table ") &&
              stmtErrorMessage.includes(" already exists"))
          ) {
            console.log(
              `  ⚠️  Skipping statement (${stmtErrorMessage.split(":")[0]}): ${trimmed.substring(0, 50)}...`
            );
            failedStatements++;
            continue; // Skip this statement, continue with next
          }

          // Re-throw other errors
          throw stmtError;
        }
      }

      // Record migration as executed (if we ran at least one statement or all were skipped due to being applied)
      if (executedAnyStatement || failedStatements === statements.length) {
        sqlite
          .prepare("INSERT OR IGNORE INTO _eros_migrations (name) VALUES (?)")
          .run(migrationName);
        console.log(`✅ Migration completed: ${migrationName}`);
      } else if (statements.length === 0) {
        // All statements were skipped (like 0003 with status check)
        sqlite
          .prepare("INSERT OR IGNORE INTO _eros_migrations (name) VALUES (?)")
          .run(migrationName);
        console.log(`✅ Migration completed: ${migrationName}`);
      }
    } catch (error: any) {
      const errorMessage = error?.message || String(error);

      // If migration fails with other types of errors, log and mark as applied if appropriate
      console.error(`❌ Migration failed: ${migrationName}`, error);

      // For certain errors, we might want to mark as applied anyway
      // This is a safety net for databases in unknown states
      if (
        errorMessage.includes("no such column") ||
        errorMessage.includes("no such table")
      ) {
        console.log(
          `⚠️  Marking ${migrationName} as applied due to schema mismatch (database may be in intermediate state)`
        );
        sqlite
          .prepare("INSERT OR IGNORE INTO _eros_migrations (name) VALUES (?)")
          .run(migrationName);
        console.log(`✅ Migration marked as applied: ${migrationName}`);
        continue;
      }

      throw error;
    }
  }

  console.log("✅ Database migrations completed successfully");
  return db;
}

export * from "./schema.js";
// Use Awaited to unwrap the Promise from the async function's return type
export type Database = Awaited<ReturnType<typeof createDatabase>>;
export type DatabaseInstance = Database;
