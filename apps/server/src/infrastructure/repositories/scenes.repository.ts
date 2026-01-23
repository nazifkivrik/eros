import { eq, and, sql } from "drizzle-orm";
import type { Database } from "@repo/database";
import { scenes, performersScenes, performers, studios } from "@repo/database";

/**
 * Scenes Repository
 * Handles all database operations for scenes
 * Pure data access - no business logic
 */
export class ScenesRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Find scene by ID
   */
  async findById(id: string) {
    return await this.db.query.scenes.findFirst({
      where: eq(scenes.id, id),
    });
  }

  /**
   * Find all scenes
   */
  async findAll() {
    return await this.db.query.scenes.findMany();
  }

  /**
   * Find scene by TPDB external ID
   */
  async findByTpdbId(tpdbId: string) {
    const allScenes = await this.db.query.scenes.findMany();
    return allScenes.find((s) =>
      s.externalIds.some((ext) => ext.source === "tpdb" && ext.id === tpdbId)
    ) || null;
  }

  /**
   * Find scene by title and date
   */
  async findByTitleAndDate(title: string, date: string) {
    return await this.db.query.scenes.findFirst({
      where: and(eq(scenes.title, title), eq(scenes.date, date)),
    }) || null;
  }

  /**
   * Find JAV scenes with codes
   */
  async findJavScenesWithCodes() {
    return await this.db.query.scenes.findMany({
      where: eq(scenes.contentType, "jav"),
    });
  }

  /**
   * Create scene
   */
  async create(data: typeof scenes.$inferInsert) {
    await this.db.insert(scenes).values(data);
    return data;
  }

  /**
   * Update scene
   */
  async update(id: string, data: Partial<typeof scenes.$inferInsert>) {
    await this.db
      .update(scenes)
      .set(data)
      .where(eq(scenes.id, id));

    return await this.findById(id);
  }

  /**
   * Link performer to scene
   */
  async linkPerformerToScene(performerId: string, sceneId: string) {
    await this.db
      .insert(performersScenes)
      .values({
        performerId,
        sceneId,
      })
      .onConflictDoNothing();
  }

  /**
   * Get performers for a scene
   */
  async getPerformersForScene(sceneId: string) {
    const relations = await this.db.query.performersScenes.findMany({
      where: eq(performersScenes.sceneId, sceneId),
      with: {
        performer: true,
      },
    });
    return relations.map((r) => r.performer);
  }

  /**
   * Check if scene exists
   */
  async exists(id: string): Promise<boolean> {
    const scene = await this.findById(id);
    return !!scene;
  }

  /**
   * Batch find scenes by IDs
   */
  async batchFindByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return await this.db.query.scenes.findMany({
      where: sql`${scenes.id} IN ${sql.raw(`('${ids.join("','")}')`)}`,
    });
  }
}
