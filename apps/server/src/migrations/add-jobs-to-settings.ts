/**
 * Migration: Add jobs field to existing app_settings
 * This ensures backward compatibility with existing databases
 */

import Database from "better-sqlite3";
import { DEFAULT_SETTINGS } from "@repo/shared-types";

const dbPath = process.env.DATABASE_PATH || "./data/app.db";
const db = new Database(dbPath);

try {
  console.log("[Migration] Checking for settings to update...");

  // Get current settings
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("app-settings") as { value: string } | undefined;

  if (row) {
    const currentSettings = JSON.parse(row.value);

    // Check if jobs field exists
    if (!currentSettings.jobs) {
      console.log("[Migration] Adding jobs field to settings...");

      // Add jobs field with defaults
      currentSettings.jobs = DEFAULT_SETTINGS.jobs;

      // Update database
      db.prepare("UPDATE app_settings SET value = ?, updatedAt = ? WHERE key = ?").run(
        JSON.stringify(currentSettings),
        new Date().toISOString(),
        "app-settings"
      );

      console.log("[Migration] ✅ Jobs field added successfully");
    } else {
      console.log("[Migration] Jobs field already exists, skipping");
    }
  } else {
    console.log("[Migration] No settings found, will be created on first use");
  }
} catch (error) {
  console.error("[Migration] ❌ Failed:", error);
  process.exit(1);
} finally {
  db.close();
}
