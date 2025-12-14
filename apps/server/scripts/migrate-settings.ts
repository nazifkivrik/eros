/**
 * Migration script to update app_settings to new format
 * Merges existing settings with default values
 */

import Database from "better-sqlite3";
import type { AppSettings } from "@repo/shared-types";
import { join } from "path";

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), "data/app.db");

const DEFAULT_SETTINGS: AppSettings = {
  general: {
    appName: "Eros",
    downloadPath: "/downloads",
    scenesPath: "/scenes",
    incompletePath: "/incomplete",
    enableNotifications: true,
    minIndexersForMetadataLess: 2,
    groupingThreshold: 0.7,
  },
  fileManagement: {
    deleteFilesOnRemove: false,
    deleteTorrentOnRemove: false,
    removeFromQbitAfterDays: 7,
    renameOnMetadata: true,
    autoRedownloadDeletedScenes: false,
    readdManuallyRemovedTorrents: false,
  },
  stashdb: {
    apiUrl: "https://stashdb.org/graphql",
    apiKey: "",
    enabled: false,
  },
  prowlarr: {
    apiUrl: "",
    apiKey: "",
    enabled: false,
  },
  qbittorrent: {
    url: "",
    username: "",
    password: "",
    enabled: false,
  },
  ai: {
    enabled: false,
    model: "Xenova/all-MiniLM-L6-v2",
    threshold: 0.75,
  },
};

console.log("🔄 Migrating app_settings to new format...");
console.log(`📁 Database: ${DB_PATH}`);

const db = new Database(DB_PATH);

// Get current settings
const result = db
  .prepare("SELECT value FROM app_settings WHERE key = ?")
  .get("app-settings") as { value: string } | undefined;

let currentSettings: Partial<AppSettings> = {};

if (result) {
  try {
    currentSettings = JSON.parse(result.value) as Partial<AppSettings>;
    console.log("📖 Found existing settings");
  } catch (error) {
    console.error("❌ Failed to parse existing settings:", error);
  }
}

// Merge with defaults
const mergedSettings: AppSettings = {
  general: {
    ...DEFAULT_SETTINGS.general,
    ...(currentSettings.general || {}),
  },
  fileManagement: {
    ...DEFAULT_SETTINGS.fileManagement,
    ...(currentSettings.fileManagement || {}),
  },
  stashdb: {
    ...DEFAULT_SETTINGS.stashdb,
    ...(currentSettings.stashdb || {}),
  },
  prowlarr: {
    ...DEFAULT_SETTINGS.prowlarr,
    ...(currentSettings.prowlarr || {}),
  },
  qbittorrent: {
    ...DEFAULT_SETTINGS.qbittorrent,
    ...(currentSettings.qbittorrent || {}),
  },
  ai: {
    ...DEFAULT_SETTINGS.ai,
    ...(currentSettings.ai || {}),
  },
};

// Update database
const now = new Date().toISOString();

if (result) {
  // Update existing
  db.prepare("UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ?").run(
    JSON.stringify(mergedSettings),
    now,
    "app-settings"
  );
  console.log("✅ Updated existing settings");
} else {
  // Insert new
  db.prepare("INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)").run(
    "app-settings",
    JSON.stringify(mergedSettings),
    now
  );
  console.log("✅ Inserted new settings");
}

// Verify
const updated = db
  .prepare("SELECT value FROM app_settings WHERE key = ?")
  .get("app-settings") as { value: string };

console.log("\n📋 Updated settings:");
console.log(JSON.stringify(JSON.parse(updated.value), null, 2));

db.close();
console.log("\n✨ Migration completed successfully!");
