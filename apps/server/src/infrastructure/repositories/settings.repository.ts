import { eq } from "drizzle-orm";
import type { Database } from "@repo/database";
import { appSettings } from "@repo/database/schema";
import type { ProvidersConfig } from "@repo/shared-types";
import { migrateToMultiProviders, needsProviderMigration } from "@repo/shared-types/migrations";

/**
 * Settings Repository
 * Data access layer for application settings
 * Responsibilities:
 * - Database CRUD operations for settings
 * - No business logic
 */
export class SettingsRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Find settings by key
   */
  async findByKey(key: string) {
    const setting = await this.db.query.appSettings.findFirst({
      where: eq(appSettings.key, key),
    });
    return setting || null;
  }

  /**
   * Get all application settings
   */
  async getSettings() {
    const setting = await this.findByKey("app-settings");
    return setting?.value as any;
  }

  /**
   * Create or update settings
   */
  async upsert(key: string, value: unknown): Promise<void> {
    const now = new Date().toISOString();

    const existing = await this.findByKey(key);

    if (existing) {
      await this.db
        .update(appSettings)
        .set({
          value,
          updatedAt: now,
        })
        .where(eq(appSettings.key, key));
    } else {
      await this.db.insert(appSettings).values({
        key,
        value,
        updatedAt: now,
      });
    }
  }

  /**
   * Check if provider migration is needed
   */
  async needsProviderMigration(): Promise<boolean> {
    const settings = await this.getSettings();
    return needsProviderMigration(settings);
  }

  /**
   * Run provider migration from single-instance to multi-provider format
   */
  async migrateProviders(): Promise<void> {
    const settings = await this.getSettings();
    const providers = migrateToMultiProviders(settings);

    // Update settings with migrated providers
    await this.upsert("app-settings", {
      ...settings,
      providers,
    });
  }
}
