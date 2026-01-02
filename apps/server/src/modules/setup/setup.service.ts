import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import argon2 from "argon2";
import type { Database } from "@repo/database";
import { users, appSettings } from "@repo/database/schema";
import type { AppSettings } from "@repo/shared-types";
import { DEFAULT_SETTINGS } from "@repo/shared-types";
import type { SetupData, SetupStatus } from "./setup.types.js";

export class SetupService {
  constructor(private db: Database) {}

  async getSetupStatus(): Promise<SetupStatus> {
    const adminUsers = await this.db.select().from(users).limit(1);
    const hasAdmin = adminUsers.length > 0;

    return {
      setupCompleted: hasAdmin,
      hasAdmin,
    };
  }

  async completeSetup(data: SetupData): Promise<void> {
    const status = await this.getSetupStatus();

    if (status.setupCompleted) {
      throw new Error("Setup has already been completed");
    }

    // Hash password using Argon2id
    const passwordHash = await argon2.hash(data.password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // Create admin user
    await this.db.insert(users).values({
      id: nanoid(),
      username: data.username,
      passwordHash,
    });

    // Update settings if provided
    if (data.settings) {
      const currentSettings = await this.db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "app-settings"))
        .limit(1);

      const baseSettings: AppSettings =
        currentSettings.length > 0
          ? { ...DEFAULT_SETTINGS, ...(currentSettings[0].value as AppSettings) }
          : DEFAULT_SETTINGS;

      // Merge provided settings
      const updatedSettings: AppSettings = {
        ...baseSettings,
        qbittorrent: data.settings.qbittorrent
          ? {
              url: data.settings.qbittorrent.url,
              username: data.settings.qbittorrent.username,
              password: data.settings.qbittorrent.password,
              enabled: data.settings.qbittorrent.enabled,
            }
          : baseSettings.qbittorrent,
        prowlarr: data.settings.prowlarr
          ? {
              apiUrl: data.settings.prowlarr.apiUrl,
              apiKey: data.settings.prowlarr.apiKey,
              enabled: data.settings.prowlarr.enabled,
            }
          : baseSettings.prowlarr,
        stashdb: data.settings.stashdb
          ? {
              apiUrl: data.settings.stashdb.apiUrl,
              apiKey: data.settings.stashdb.apiKey,
              enabled: data.settings.stashdb.enabled,
            }
          : baseSettings.stashdb,
      };

      // Insert or update settings
      if (currentSettings.length > 0) {
        await this.db
          .update(appSettings)
          .set({ value: updatedSettings })
          .where(eq(appSettings.key, "app-settings"));
      } else {
        await this.db.insert(appSettings).values({
          key: "app-settings",
          value: updatedSettings,
        });
      }
    }
  }
}
