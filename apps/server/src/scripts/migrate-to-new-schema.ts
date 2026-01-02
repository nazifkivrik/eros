#!/usr/bin/env tsx
/**
 * Migration script to transform existing data to new schema
 * Run with: pnpm tsx apps/server/src/scripts/migrate-to-new-schema.ts
 */

import { db } from "@repo/database";
import { performers, studios, scenes } from "@repo/database/schema";
import { sql } from "drizzle-orm";

async function migratePerformers() {
  console.log("Migrating performers...");

  // Add new columns with ALTER TABLE
  await db.run(sql`
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS rating REAL NOT NULL DEFAULT 0;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS birthplace_code TEXT;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS astrology TEXT;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS hair_colour TEXT;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS eye_colour TEXT;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS cupsize TEXT;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS waist TEXT;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS hips TEXT;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS fake_boobs INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS career_start_year INTEGER;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS career_end_year INTEGER;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS same_sex_only INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS thumbnail TEXT;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS poster TEXT;
    ALTER TABLE performers ADD COLUMN IF NOT EXISTS links TEXT;
  `);

  // Update full_name from name where empty
  await db.run(sql`
    UPDATE performers
    SET full_name = name
    WHERE full_name = '';
  `);

  // Generate slugs from names
  await db.run(sql`
    UPDATE performers
    SET slug = LOWER(REPLACE(REPLACE(name, ' ', '-'), '.', ''))
    WHERE slug = '';
  `);

  // Drop old columns that don't exist in new schema
  await db.run(sql`
    ALTER TABLE performers DROP COLUMN IF EXISTS stashdb_id;
    ALTER TABLE performers DROP COLUMN IF EXISTS career_length;
  `);

  console.log("Performers migration completed");
}

async function migrateStudios() {
  console.log("Migrating studios...");

  await db.run(sql`
    ALTER TABLE studios ADD COLUMN IF NOT EXISTS short_name TEXT;
    ALTER TABLE studios ADD COLUMN IF NOT EXISTS slug TEXT;
    ALTER TABLE studios ADD COLUMN IF NOT EXISTS rating REAL NOT NULL DEFAULT 0;
    ALTER TABLE studios ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE studios ADD COLUMN IF NOT EXISTS network_id TEXT;
    ALTER TABLE studios ADD COLUMN IF NOT EXISTS logo TEXT;
    ALTER TABLE studios ADD COLUMN IF NOT EXISTS favicon TEXT;
    ALTER TABLE studios ADD COLUMN IF NOT EXISTS poster TEXT;
    ALTER TABLE studios ADD COLUMN IF NOT EXISTS links TEXT;
  `);

  // Generate slugs from names
  await db.run(sql`
    UPDATE studios
    SET slug = LOWER(REPLACE(REPLACE(name, ' ', '-'), '.', ''))
    WHERE slug IS NULL OR slug = '';
  `);

  // Drop old columns
  await db.run(sql`
    ALTER TABLE studios DROP COLUMN IF EXISTS stashdb_id;
  `);

  console.log("Studios migration completed");
}

async function migrateScenes() {
  console.log("Migrating scenes...");

  await db.run(sql`
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'scene';
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS format TEXT;
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS external_id TEXT;
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS sku TEXT;
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS url TEXT;
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS poster TEXT;
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS back_image TEXT;
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS thumbnail TEXT;
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS trailer TEXT;
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS background TEXT;
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS rating REAL NOT NULL DEFAULT 0;
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS site_id TEXT REFERENCES studios(id) ON DELETE SET NULL;
    ALTER TABLE scenes ADD COLUMN IF NOT EXISTS links TEXT;
  `);

  // Generate slugs from titles
  await db.run(sql`
    UPDATE scenes
    SET slug = LOWER(REPLACE(REPLACE(title, ' ', '-'), '.', ''))
    WHERE slug = '';
  `);

  // Map content type from tpdb_content_type if it exists
  await db.run(sql`
    UPDATE scenes
    SET content_type = COALESCE(tpdb_content_type, 'scene')
    WHERE content_type = 'scene';
  `);

  // Copy details to description
  await db.run(sql`
    UPDATE scenes
    SET description = details
    WHERE description IS NULL AND details IS NOT NULL;
  `);

  // Drop old columns
  await db.run(sql`
    ALTER TABLE scenes DROP COLUMN IF EXISTS stashdb_id;
    ALTER TABLE scenes DROP COLUMN IF EXISTS details;
    ALTER TABLE scenes DROP COLUMN IF EXISTS director;
    ALTER TABLE scenes DROP COLUMN IF EXISTS urls;
  `);

  console.log("Scenes migration completed");
}

async function createNewTables() {
  console.log("Creating new tables...");

  // Directors table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS directors (
      id TEXT PRIMARY KEY,
      tpdb_id TEXT UNIQUE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Scene markers table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS scene_markers (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Scene hashes table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS scene_hashes (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      hash TEXT NOT NULL,
      type TEXT NOT NULL,
      duration INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create indexes
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS scene_hashes_hash_idx ON scene_hashes(hash);
    CREATE INDEX IF NOT EXISTS scene_hashes_type_hash_idx ON scene_hashes(type, hash);
  `);

  // Directors-Scenes junction table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS directors_scenes (
      director_id TEXT NOT NULL REFERENCES directors(id) ON DELETE CASCADE,
      scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      PRIMARY KEY (director_id, scene_id)
    );
  `);

  console.log("New tables created");
}

async function main() {
  try {
    console.log("Starting database migration...\n");

    await createNewTables();
    await migratePerformers();
    await migrateStudios();
    await migrateScenes();

    console.log("\n✅ Migration completed successfully!");
    console.log("\nNote: Some old columns have been dropped.");
    console.log("Make sure to backup your database before running this script in production.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

main();
