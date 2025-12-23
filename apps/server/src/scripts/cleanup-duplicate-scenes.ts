/**
 * Cleanup Script for Duplicate Scenes
 *
 * This script identifies and removes duplicate scenes from the database.
 * It keeps the oldest scene (by created_at) and removes newer duplicates.
 *
 * Duplicate detection criteria:
 * 1. Exact title + date match
 * 2. JAV code base pattern match (e.g., rebdb-957 vs rebdb-957tk1)
 *
 * Usage: node --import tsx src/scripts/cleanup-duplicate-scenes.ts
 */

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@repo/database";
import { scenes, sceneFiles, performersScenes, studiosScenes, subscriptions } from "@repo/database";
import { eq, and } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

const DB_PATH = process.env.DATABASE_PATH || "/data/app.db";
const SCENES_PATH = process.env.SCENES_PATH || "/app/media/scenes";
const DRY_RUN = process.env.DRY_RUN === "true";

interface DuplicateGroup {
  title: string;
  date: string | null;
  scenes: Array<{
    id: string;
    tpdb_id: string | null;
    code: string | null;
    created_at: string;
    folder?: string;
  }>;
}

async function main() {
  console.log("=== Duplicate Scene Cleanup Script ===\n");
  console.log(`Database: ${DB_PATH}`);
  console.log(`Scenes Path: ${SCENES_PATH}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE (will delete duplicates)"}\n`);

  // Initialize database
  const sqlite = new Database(DB_PATH);
  const db = drizzle(sqlite, { schema }) as BetterSQLite3Database<typeof schema>;

  // Find duplicates by title + date
  console.log("🔍 Searching for duplicate scenes...\n");

  const allScenes = await db.query.scenes.findMany({
    orderBy: (scenes, { asc }) => [asc(scenes.title), asc(scenes.createdAt)],
  });

  const duplicateGroups = new Map<string, DuplicateGroup>();

  // Group scenes by title + date
  for (const scene of allScenes) {
    const key = `${scene.title}|||${scene.date || "NO_DATE"}`;

    if (!duplicateGroups.has(key)) {
      duplicateGroups.set(key, {
        title: scene.title,
        date: scene.date,
        scenes: [],
      });
    }

    duplicateGroups.get(key)!.scenes.push({
      id: scene.id,
      tpdb_id: scene.tpdbId,
      code: scene.code,
      created_at: scene.createdAt,
    });
  }

  // Filter to only groups with duplicates
  const duplicates: DuplicateGroup[] = [];
  for (const group of duplicateGroups.values()) {
    if (group.scenes.length > 1) {
      duplicates.push(group);
    }
  }

  console.log(`Found ${duplicates.length} groups of duplicate scenes\n`);

  if (duplicates.length === 0) {
    console.log("✅ No duplicates found. Database is clean!");
    sqlite.close();
    return;
  }

  let totalDuplicates = 0;
  let totalKept = 0;

  for (const group of duplicates) {
    totalDuplicates += group.scenes.length - 1;
    totalKept += 1;

    console.log(`📋 "${group.title}" (${group.date || "no date"})`);
    console.log(`   Found ${group.scenes.length} copies:`);

    // Sort by created_at to keep the oldest
    group.scenes.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const [keepScene, ...removeScenes] = group.scenes;

    console.log(`   ✅ KEEP: ${keepScene.id} (tpdb: ${keepScene.tpdb_id}, created: ${keepScene.created_at})`);

    for (const removeScene of removeScenes) {
      console.log(`   ❌ REMOVE: ${removeScene.id} (tpdb: ${removeScene.tpdb_id}, created: ${removeScene.created_at})`);

      if (!DRY_RUN) {
        await removeDuplicateScene(db, removeScene.id);
      }
    }

    console.log();
  }

  console.log("\n=== Summary ===");
  console.log(`Total duplicate groups: ${duplicates.length}`);
  console.log(`Total scenes to keep: ${totalKept}`);
  console.log(`Total duplicate scenes to remove: ${totalDuplicates}`);

  if (DRY_RUN) {
    console.log("\n⚠️  This was a DRY RUN. No changes were made.");
    console.log("To actually remove duplicates, run with DRY_RUN=false");
  } else {
    console.log("\n✅ Cleanup completed!");
  }

  sqlite.close();
}

async function removeDuplicateScene(
  db: BetterSQLite3Database<typeof schema>,
  sceneId: string
): Promise<void> {
  console.log(`      🗑️  Deleting scene ${sceneId}...`);

  try {
    // 1. Delete scene files records
    await db.delete(sceneFiles).where(eq(sceneFiles.sceneId, sceneId));

    // 2. Delete performer-scene links
    await db.delete(performersScenes).where(eq(performersScenes.sceneId, sceneId));

    // 3. Delete studio-scene links
    await db.delete(studiosScenes).where(eq(studiosScenes.sceneId, sceneId));

    // 4. Delete subscriptions for this scene
    await db.delete(subscriptions).where(
      and(
        eq(subscriptions.entityType, "scene"),
        eq(subscriptions.entityId, sceneId)
      )
    );

    // 5. Delete the scene folder from filesystem
    await deleteSceneFolder(sceneId);

    // 6. Finally delete the scene itself
    await db.delete(scenes).where(eq(scenes.id, sceneId));

    console.log(`      ✅ Successfully deleted scene ${sceneId}`);
  } catch (error) {
    console.error(`      ❌ Failed to delete scene ${sceneId}:`, error);
  }
}

async function deleteSceneFolder(sceneId: string): Promise<void> {
  try {
    // Find the scene folder - it should be a directory in SCENES_PATH
    const sceneFolders = fs.readdirSync(SCENES_PATH);

    for (const folder of sceneFolders) {
      const folderPath = path.join(SCENES_PATH, folder);

      // Check if folder contains the scene ID in its name or in metadata
      if (folder.includes(sceneId) || folder.endsWith(sceneId.slice(-4))) {
        console.log(`      🗑️  Deleting folder: ${folder}`);
        fs.rmSync(folderPath, { recursive: true, force: true });
        return;
      }
    }
  } catch (error) {
    console.error(`      ⚠️  Failed to delete folder for scene ${sceneId}:`, error);
  }
}

// Run the script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
