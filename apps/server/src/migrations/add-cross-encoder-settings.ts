/**
 * Migration: Add Cross-Encoder AI settings fields
 *
 * Adds the following fields to AI settings:
 * - useCrossEncoder: boolean (default: false)
 * - crossEncoderThreshold: number (default: 0.7)
 * - unknownThreshold: number (default: 0.4)
 */

import type { Database } from "@repo/database";
import { appSettings } from "@repo/database/schema";
import { eq } from "drizzle-orm";

export async function migrateCrossEncoderSettings(db: Database) {
  console.log("[Migration] Adding Cross-Encoder settings fields...");

  try {
    // Get current settings
    const currentSettings = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "app-settings"),
    });

    if (!currentSettings) {
      console.log("[Migration] No app-settings found, skipping migration");
      return;
    }

    const settings = currentSettings.value as any;

    // Check if AI settings exist
    if (!settings.ai) {
      console.log("[Migration] No AI settings found, skipping migration");
      return;
    }

    // Check if fields already exist
    if (
      "useCrossEncoder" in settings.ai &&
      "crossEncoderThreshold" in settings.ai &&
      "unknownThreshold" in settings.ai
    ) {
      console.log("[Migration] Cross-Encoder settings already exist, skipping migration");
      return;
    }

    // Add new fields with defaults
    const updatedSettings = {
      ...settings,
      ai: {
        ...settings.ai,
        useCrossEncoder: settings.ai.useCrossEncoder ?? false,
        crossEncoderThreshold: settings.ai.crossEncoderThreshold ?? 0.7,
        unknownThreshold: settings.ai.unknownThreshold ?? 0.4,
      },
    };

    // Update database
    await db
      .update(appSettings)
      .set({ value: updatedSettings })
      .where(eq(appSettings.key, "app-settings"));

    console.log("[Migration] ✅ Cross-Encoder settings added successfully");
    console.log("[Migration]    - useCrossEncoder: false (disabled by default)");
    console.log("[Migration]    - crossEncoderThreshold: 0.7");
    console.log("[Migration]    - unknownThreshold: 0.4");
  } catch (error) {
    console.error("[Migration] ❌ Failed to add Cross-Encoder settings:", error);
    throw error;
  }
}
