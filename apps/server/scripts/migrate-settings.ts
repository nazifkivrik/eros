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
  },
  fileManagement: {
    deleteFilesOnRemove: false,
    deleteTorrentOnRemove: false,
    removeFromQbitAfterDays: 7,
    renameOnMetadata: true,
  },
  stashdb: {
    apiUrl: "https://stashdb.org/graphql",
    apiKey: "",
    enabled: false,
  },
  tpdb: {
    apiUrl: "https://api.theporndb.net",
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
    useCrossEncoder: true,
    crossEncoderThreshold: 0.65,
    unknownThreshold: 0.35,
    groupingCount: 10,
  },
  jobs: {
    subscriptionSearch: {
      enabled: true,
      schedule: "0 */6 * * *",
    },
    metadataRefresh: {
      enabled: true,
      schedule: "0 3 * * *",
    },
    torrentMonitor: {
      enabled: true,
      schedule: "*/5 * * * *",
    },
    cleanup: {
      enabled: false,
      schedule: "0 2 * * *",
    },
    metadataDiscovery: {
      enabled: false,
      schedule: "0 4 * * *",
    },
    missingScenesSearch: {
      enabled: false,
      schedule: "0 5 * * *",
    },
    unifiedSync: {
      enabled: false,
      schedule: "*/30 * * * *",
    },
    qbittorrentCleanup: {
      enabled: false,
      schedule: "0 1 * * *",
    },
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
  tpdb: {
    ...DEFAULT_SETTINGS.tpdb,
    ...(currentSettings.tpdb || {}),
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
  jobs: {
    subscriptionSearch: {
      ...DEFAULT_SETTINGS.jobs.subscriptionSearch,
      ...(currentSettings.jobs?.subscriptionSearch || {}),
    },
    metadataRefresh: {
      ...DEFAULT_SETTINGS.jobs.metadataRefresh,
      ...(currentSettings.jobs?.metadataRefresh || {}),
    },
    torrentMonitor: {
      ...DEFAULT_SETTINGS.jobs.torrentMonitor,
      ...(currentSettings.jobs?.torrentMonitor || {}),
    },
    cleanup: {
      ...DEFAULT_SETTINGS.jobs.cleanup,
      ...(currentSettings.jobs?.cleanup || {}),
    },
    metadataDiscovery: {
      ...DEFAULT_SETTINGS.jobs.metadataDiscovery,
      ...(currentSettings.jobs?.metadataDiscovery || {}),
    },
    missingScenesSearch: {
      ...DEFAULT_SETTINGS.jobs.missingScenesSearch,
      ...(currentSettings.jobs?.missingScenesSearch || {}),
    },
    unifiedSync: {
      ...DEFAULT_SETTINGS.jobs.unifiedSync,
      ...(currentSettings.jobs?.unifiedSync || {}),
    },
    qbittorrentCleanup: {
      ...DEFAULT_SETTINGS.jobs.qbittorrentCleanup,
      ...(currentSettings.jobs?.qbittorrentCleanup || {}),
    },
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
