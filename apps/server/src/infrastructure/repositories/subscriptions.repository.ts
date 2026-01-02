import { eq, and } from "drizzle-orm";
import type { Database } from "@repo/database";
import {
  subscriptions,
  performers,
  studios,
  scenes,
  qualityProfiles,
  performersScenes,
  sceneFiles,
  downloadQueue,
} from "@repo/database";

/**
 * Subscriptions Repository
 * Handles all database operations for subscriptions
 * Pure data access - no business logic
 */
export class SubscriptionsRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Find subscription by entity
   */
  async findByEntity(entityType: string, entityId: string) {
    return await this.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.entityType, entityType),
        eq(subscriptions.entityId, entityId)
      ),
    });
  }

  /**
   * Find all subscriptions
   */
  async findAll() {
    return await this.db.query.subscriptions.findMany({
      orderBy: (subscriptions, { desc }) => [desc(subscriptions.createdAt)],
    });
  }

  /**
   * Find subscription by ID
   */
  async findById(id: string) {
    return await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, id),
    });
  }

  /**
   * Find subscriptions by type
   */
  async findByType(entityType: string) {
    return await this.db.query.subscriptions.findMany({
      where: eq(subscriptions.entityType, entityType),
      orderBy: (subscriptions, { desc }) => [desc(subscriptions.createdAt)],
    });
  }

  /**
   * Create subscription
   */
  async create(data: typeof subscriptions.$inferInsert) {
    await this.db.insert(subscriptions).values(data);
    return data;
  }

  /**
   * Update subscription
   */
  async update(id: string, data: Partial<typeof subscriptions.$inferInsert>) {
    await this.db
      .update(subscriptions)
      .set(data)
      .where(eq(subscriptions.id, id));

    return await this.findById(id);
  }

  /**
   * Delete subscription
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(subscriptions).where(eq(subscriptions.id, id));
  }

  /**
   * Check if subscription exists
   */
  async exists(id: string): Promise<boolean> {
    const subscription = await this.findById(id);
    return !!subscription;
  }

  /**
   * Batch fetch performers for subscriptions
   */
  async batchFetchPerformers(ids: string[]) {
    if (ids.length === 0) return new Map();

    const performersList = await this.db.query.performers.findMany({
      where: (performers, { inArray }) => inArray(performers.id, ids),
    });

    return new Map(performersList.map((p) => [p.id, p]));
  }

  /**
   * Batch fetch studios for subscriptions
   */
  async batchFetchStudios(ids: string[]) {
    if (ids.length === 0) return new Map();

    const studiosList = await this.db.query.studios.findMany({
      where: (studios, { inArray }) => inArray(studios.id, ids),
    });

    return new Map(studiosList.map((s) => [s.id, s]));
  }

  /**
   * Batch fetch scenes for subscriptions
   */
  async batchFetchScenes(ids: string[]) {
    if (ids.length === 0) return new Map();

    const scenesList = await this.db.query.scenes.findMany({
      where: (scenes, { inArray }) => inArray(scenes.id, ids),
    });

    return new Map(scenesList.map((s) => [s.id, s]));
  }

  /**
   * Find subscription with details (performer/studio/scene)
   */
  async findByIdWithDetails(id: string) {
    const subscription = await this.findById(id);
    if (!subscription) return null;

    // Fetch related entity based on type
    let entity = null;
    if (subscription.entityType === "performer") {
      entity = await this.db.query.performers.findFirst({
        where: eq(performers.id, subscription.entityId),
      });
    } else if (subscription.entityType === "studio") {
      entity = await this.db.query.studios.findFirst({
        where: eq(studios.id, subscription.entityId),
      });
    } else if (subscription.entityType === "scene") {
      entity = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, subscription.entityId),
      });
    }

    // Fetch quality profile
    const qualityProfile = await this.db.query.qualityProfiles.findFirst({
      where: eq(qualityProfiles.id, subscription.qualityProfileId),
    });

    return {
      ...subscription,
      entity,
      qualityProfile,
    };
  }

  /**
   * Get scenes for a performer subscription
   */
  async getPerformerScenes(performerId: string) {
    const sceneRelations = await this.db.query.performersScenes.findMany({
      where: (performersScenes, { eq }) =>
        eq(performersScenes.performerId, performerId),
      with: {
        scene: {
          with: {
            sceneFiles: true,
          },
        },
      },
    });
    return sceneRelations.map((rel: any) => rel.scene).filter(Boolean);
  }

  /**
   * Get scenes for a studio subscription
   */
  async getStudioScenes(studioId: string) {
    return await this.db.query.scenes.findMany({
      where: (scenes, { eq }) => eq(scenes.siteId, studioId),
      with: {
        sceneFiles: true,
      },
    });
  }

  /**
   * Get download queue entry for scene
   */
  async getSceneDownloadQueue(sceneId: string) {
    return await this.db.query.downloadQueue.findFirst({
      where: (dq, { eq }) => eq(dq.sceneId, sceneId),
      orderBy: (dq, { desc }) => [desc(dq.addedAt)],
    });
  }

  /**
   * Get scene files
   */
  async getSceneFiles(sceneId: string) {
    return await this.db.query.sceneFiles.findMany({
      where: (sceneFiles, { eq }) => eq(sceneFiles.sceneId, sceneId),
    });
  }
}
