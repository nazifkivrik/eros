import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@repo/database/schema';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the path to the migrations folder in the database package
// The migrations are in @repo/database/src/migrations
// Use absolute path from workspace root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Navigate from apps/server/test/fixtures/ to packages/database/src/migrations
const migrationsFolder = join(__dirname, '../../../../packages/database/src/migrations');

/**
 * Create an in-memory SQLite database for testing
 * Migrations are run automatically to set up schema
 */
export async function createTestDatabase() {
  // Create in-memory database
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });

  // Run migrations
  try {
    await migrate(db, { migrationsFolder });
  } catch (error) {
    console.error('Test database migration failed:', error);
    throw error;
  }

  return db;
}

/**
 * Clean all tables in the test database
 * Useful for isolating test cases
 */
export async function cleanDatabase(db: ReturnType<typeof drizzle>) {
  // Delete in order of dependencies (child tables first)
  await db.delete(schema.sceneFiles);
  await db.delete(schema.downloadQueue);
  await db.delete(schema.performersScenes);
  await db.delete(schema.scenes);
  await db.delete(schema.subscriptions);
  await db.delete(schema.qualityProfiles);
  await db.delete(schema.performers);
  await db.delete(schema.studios);
  // Skip jobs table for now due to potential FK issues
}
