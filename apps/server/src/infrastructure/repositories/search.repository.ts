import { eq, lt } from "drizzle-orm";
import type { Database } from "@repo/database";
import { performers, studios, scenes, searchHistory } from "@repo/database/schema";

/**
 * Search Repository
 * Data access layer for local database searches
 * Responsibilities:
 * - Local database lookups for performers, studios, scenes
 * - No business logic
 */
export class SearchRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Find performer by ID in local database
   */
  async findPerformerById(id: string) {
    const performer = await this.db.query.performers.findFirst({
      where: eq(performers.id, id),
    });
    return performer || null;
  }

  /**
   * Find studio by ID in local database
   */
  async findStudioById(id: string) {
    const studio = await this.db.query.studios.findFirst({
      where: eq(studios.id, id),
    });
    return studio || null;
  }

  /**
   * Find scene by ID in local database with files
   */
  async findSceneById(id: string) {
    const scene = await this.db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      with: {
        sceneFiles: true,
      },
    });
    return scene || null;
  }

  /**
   * Delete old search history
   */
  async deleteOldSearchHistory(cutoffDate: string): Promise<number> {
    const result = await this.db
      .delete(searchHistory)
      .where(lt(searchHistory.searchedAt, cutoffDate))
      .returning({ id: searchHistory.id });

    return result.length;
  }
}
