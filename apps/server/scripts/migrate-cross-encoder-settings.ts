/**
 * Migration script to add Cross-Encoder AI settings
 * Adds new fields: useCrossEncoder, crossEncoderThreshold, unknownThreshold
 */

import Database from "better-sqlite3";
import { join } from "path";

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), "../../data/app.db");

const CROSS_ENCODER_DEFAULTS = {
  useCrossEncoder: false,
  crossEncoderThreshold: 0.7,
  unknownThreshold: 0.4,
};

console.log("🔄 Adding Cross-Encoder settings to AI configuration...");
console.log(`📁 Database: ${DB_PATH}`);

const db = new Database(DB_PATH);

// Get current settings
const result = db
  .prepare("SELECT value FROM app_settings WHERE key = ?")
  .get("app-settings") as { value: string } | undefined;

if (!result) {
  console.error("❌ No app-settings found in database");
  db.close();
  process.exit(1);
}

let settings: any;
try {
  settings = JSON.parse(result.value);
  console.log("📖 Found existing settings");
} catch (error) {
  console.error("❌ Failed to parse existing settings:", error);
  db.close();
  process.exit(1);
}

// Check if AI settings exist
if (!settings.ai) {
  console.error("❌ No AI settings found");
  db.close();
  process.exit(1);
}

// Check if fields already exist
if (
  "useCrossEncoder" in settings.ai &&
  "crossEncoderThreshold" in settings.ai &&
  "unknownThreshold" in settings.ai
) {
  console.log("ℹ️  Cross-Encoder settings already exist");
  console.log(`   - useCrossEncoder: ${settings.ai.useCrossEncoder}`);
  console.log(`   - crossEncoderThreshold: ${settings.ai.crossEncoderThreshold}`);
  console.log(`   - unknownThreshold: ${settings.ai.unknownThreshold}`);
  db.close();
  console.log("\n✨ No migration needed!");
  process.exit(0);
}

// Add new fields
const updatedSettings = {
  ...settings,
  ai: {
    ...settings.ai,
    ...CROSS_ENCODER_DEFAULTS,
  },
};

// Update database
const now = new Date().toISOString();
db.prepare("UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ?").run(
  JSON.stringify(updatedSettings),
  now,
  "app-settings"
);

console.log("✅ Cross-Encoder settings added successfully");
console.log(`   - useCrossEncoder: ${CROSS_ENCODER_DEFAULTS.useCrossEncoder} (disabled by default)`);
console.log(`   - crossEncoderThreshold: ${CROSS_ENCODER_DEFAULTS.crossEncoderThreshold}`);
console.log(`   - unknownThreshold: ${CROSS_ENCODER_DEFAULTS.unknownThreshold}`);

// Verify
const updated = db
  .prepare("SELECT value FROM app_settings WHERE key = ?")
  .get("app-settings") as { value: string };

const updatedAI = JSON.parse(updated.value).ai;
console.log("\n📋 Updated AI settings:");
console.log(JSON.stringify(updatedAI, null, 2));

db.close();
console.log("\n✨ Migration completed successfully!");
console.log("\n💡 To enable Cross-Encoder, set useCrossEncoder to true in the Settings UI");
