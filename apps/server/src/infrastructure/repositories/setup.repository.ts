import { eq } from "drizzle-orm";
import type { Database } from "@repo/database";
import { users, appSettings } from "@repo/database";

/**
 * Setup Repository
 * Handles database operations for initial setup
 * Pure data access - no business logic
 */
export class SetupRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Check if any users exist
   */
  async hasUsers(): Promise<boolean> {
    const userList = await this.db.select().from(users).limit(1);
    return userList.length > 0;
  }

  /**
   * Create a user
   */
  async createUser(data: typeof users.$inferInsert) {
    await this.db.insert(users).values(data);
    return data;
  }

  /**
   * Get app settings
   */
  async getAppSettings() {
    const settings = await this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "app-settings"))
      .limit(1);

    return settings.length > 0 ? settings[0] : null;
  }

  /**
   * Create app settings
   */
  async createAppSettings(value: any) {
    await this.db.insert(appSettings).values({
      key: "app-settings",
      value,
    });
  }

  /**
   * Update app settings
   */
  async updateAppSettings(value: any) {
    await this.db
      .update(appSettings)
      .set({ value })
      .where(eq(appSettings.key, "app-settings"));
  }
}
