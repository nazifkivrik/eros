import { eq, and } from "drizzle-orm";
import type { Database } from "@repo/database";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
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
  private _db: BetterSQLite3Database<typeof import("@repo/database/schema")>;
  constructor({ db }: { db: Database }) {
    // Unwrap Promise - Database is Promise<DrizzleDB> but at runtime it's resolved
    this._db = db as unknown as BetterSQLite3Database<typeof import("@repo/database/schema")>;
  }

  /**
   * Find subscription by entity
   */
  async findByEntity(entityType: "performer" | "studio" | "scene", entityId: string) {
    return await this._db.query.subscriptions.findFirst({
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
    return await this._db.query.subscriptions.findMany({
      orderBy: (subscriptions, { desc }) => [desc(subscriptions.createdAt)],
    });
  }

  /**
   * Find all subscriptions with details (entity + quality profile)
   * Supports optional filters for search and metadata status
   */
  async findAllWithDetails(filters?: { search?: string; includeMetaless?: boolean; showInactive?: boolean }) {
    const subscriptionsList = await this._db.query.subscriptions.findMany({
      orderBy: (subscriptions, { desc }) => [desc(subscriptions.createdAt)],
    });

    // Batch fetch all related entities
    const performerIds = subscriptionsList
      .filter((s) => s.entityType === "performer")
      .map((s) => s.entityId);
    const studioIds = subscriptionsList
      .filter((s) => s.entityType === "studio")
      .map((s) => s.entityId);
    const sceneIds = subscriptionsList
      .filter((s) => s.entityType === "scene")
      .map((s) => s.entityId);
    const qualityProfileIds = subscriptionsList.map((s) => s.qualityProfileId);

    const [performersMap, studiosMap, scenesMap, qualityProfilesMap] = await Promise.all([
      this.batchFetchPerformers(performerIds),
      this.batchFetchStudios(studioIds),
      this.batchFetchScenes(sceneIds),
      this.batchFetchQualityProfiles(qualityProfileIds),
    ]);

    // Hydrate subscriptions with their entities and quality profiles
    const hydrated = subscriptionsList.map((subscription) => {
      let entity = null;
      if (subscription.entityType === "performer") {
        entity = performersMap.get(subscription.entityId) || null;
      } else if (subscription.entityType === "studio") {
        entity = studiosMap.get(subscription.entityId) || null;
      } else if (subscription.entityType === "scene") {
        entity = scenesMap.get(subscription.entityId) || null;
      }

      const qualityProfile = qualityProfilesMap.get(subscription.qualityProfileId) || null;

      // Calculate entityName
      let entityName = subscription.entityId; // Default to ID if not found
      if (entity) {
        if (subscription.entityType === "performer" || subscription.entityType === "studio") {
          entityName = (entity as any).name || subscription.entityId;
        } else if (subscription.entityType === "scene") {
          entityName = (entity as any).title || subscription.entityId;
        }
      }

      return {
        ...subscription,
        entity,
        entityName,
        qualityProfile,
      };
    });

    // Apply filters if provided
    let result = hydrated;

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter((sub: any) => {
        // Search in entity name
        if (sub.entity) {
          const name = sub.entity.name || sub.entity.title || "";
          if (name.toLowerCase().includes(searchLower)) {
            return true;
          }
        }
        return false;
      });
    }

    if (filters?.includeMetaless === false) {
      // When explicitly false, only show scenes WITH metadata
      result = result.filter((sub: any) => {
        if (!sub.entity) return false;
        if (sub.entityType === "scene") {
          return sub.entity.hasMetadata === true;
        }
        return true;
      });
    }
    // When includeMetaless is true or undefined, show all (no filter)

    if (filters?.showInactive === false) {
      // Only show active subscriptions
      result = result.filter((sub: any) => sub.isSubscribed === true);
    }

    return result;
  }

  /**
   * Batch fetch quality profiles
   */
  async batchFetchQualityProfiles(ids: string[]) {
    if (ids.length === 0) return new Map();

    const qualityProfilesList = await this._db.query.qualityProfiles.findMany({
      where: (qualityProfiles, { inArray }) => inArray(qualityProfiles.id, ids),
    });

    return new Map(qualityProfilesList.map((qp) => [qp.id, qp]));
  }

  /**
   * Find subscription by ID
   */
  async findById(id: string) {
    return await this._db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, id),
    });
  }

  /**
   * Find subscriptions by type
   */
  async findByType(entityType: "performer" | "studio" | "scene") {
    return await this._db.query.subscriptions.findMany({
      where: eq(subscriptions.entityType, entityType),
      orderBy: (subscriptions, { desc }) => [desc(subscriptions.createdAt)],
    });
  }

  /**
   * Create subscription
   */
  async create(data: typeof subscriptions.$inferInsert) {
    await this._db.insert(subscriptions).values(data);
    return data;
  }

  /**
   * Update subscription
   */
  async update(id: string, data: Partial<typeof subscriptions.$inferInsert>) {
    await this._db
      .update(subscriptions)
      .set(data)
      .where(eq(subscriptions.id, id));

    return await this.findById(id);
  }

  /**
   * Delete subscription
   */
  async delete(id: string): Promise<void> {
    await this._db.delete(subscriptions).where(eq(subscriptions.id, id));
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

    const performersList = await this._db.query.performers.findMany({
      where: (performers, { inArray }) => inArray(performers.id, ids),
    });

    return new Map(performersList.map((p) => [p.id, p]));
  }

  /**
   * Batch fetch studios for subscriptions
   */
  async batchFetchStudios(ids: string[]) {
    if (ids.length === 0) return new Map();

    const studiosList = await this._db.query.studios.findMany({
      where: (studios, { inArray }) => inArray(studios.id, ids),
    });

    return new Map(studiosList.map((s) => [s.id, s]));
  }

  /**
   * Batch fetch scenes for subscriptions
   */
  async batchFetchScenes(ids: string[]) {
    if (ids.length === 0) return new Map();

    const scenesList = await this._db.query.scenes.findMany({
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
      entity = await this._db.query.performers.findFirst({
        where: eq(performers.id, subscription.entityId),
      });
    } else if (subscription.entityType === "studio") {
      entity = await this._db.query.studios.findFirst({
        where: eq(studios.id, subscription.entityId),
      });
    } else if (subscription.entityType === "scene") {
      entity = await this._db.query.scenes.findFirst({
        where: eq(scenes.id, subscription.entityId),
      });
    }

    // Fetch quality profile
    const qualityProfile = await this._db.query.qualityProfiles.findFirst({
      where: eq(qualityProfiles.id, subscription.qualityProfileId),
    });

    // Calculate entityName
    let entityName = subscription.entityId; // Default to ID if not found
    if (entity) {
      if (subscription.entityType === "performer" || subscription.entityType === "studio") {
        entityName = (entity as any).name || subscription.entityId;
      } else if (subscription.entityType === "scene") {
        entityName = (entity as any).title || subscription.entityId;
      }
    }

    return {
      ...subscription,
      entity,
      entityName,
      qualityProfile,
    };
  }

  /**
   * Get scenes for a performer subscription
   * Includes both scenes from junction table AND metadata-less scenes inferred from indexers
   */
  async getPerformerScenes(performerId: string) {
    // First, get scenes from junction table (metadata from StashDB)
    const sceneRelations = await this._db.query.performersScenes.findMany({
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
    const junctionScenes = sceneRelations.map((rel: any) => rel.scene).filter(Boolean);

    // Also get metadata-less scenes that were inferred from indexers for this performer
    // These are created during torrent search when a scene title matches but has no metadata
    const inferredScenes = await this._db.query.scenes.findMany({
      where: (scenes, { eq, and }) =>
        and(
          eq(scenes.inferredFromIndexers, true),
          eq(scenes.hasMetadata, false)
        ),
      with: {
        sceneFiles: true,
      },
    });

    // Merge and deduplicate by scene ID
    const allScenes = [...junctionScenes];
    const sceneIds = new Set(junctionScenes.map((s: any) => s.id));

    for (const scene of inferredScenes) {
      if (!sceneIds.has(scene.id)) {
        allScenes.push(scene);
        sceneIds.add(scene.id);
      }
    }

    return allScenes;
  }

  /**
   * Get scenes for a studio subscription
   * Includes both scenes with siteId AND metadata-less scenes inferred from indexers
   */
  async getStudioScenes(studioId: string) {
    // Get the studio to get its name for filtering metadata-less scenes
    const studio = await this._db.query.studios.findFirst({
      where: (studios, { eq }) => eq(studios.id, studioId),
    });

    // Get scenes with this studio's siteId (metadata from StashDB)
    const studioScenes = await this._db.query.scenes.findMany({
      where: (scenes, { eq }) => eq(scenes.siteId, studioId),
      with: {
        sceneFiles: true,
      },
    });

    // Get metadata-less scenes inferred from indexers
    // Filter by studio name in title to only show relevant scenes
    const allInferredScenes = await this._db.query.scenes.findMany({
      where: (scenes, { and }) =>
        and(
          eq(scenes.inferredFromIndexers, true),
          eq(scenes.hasMetadata, false)
        ),
      with: {
        sceneFiles: true,
      },
    });

    // Filter inferred scenes to only those that might belong to this studio
    // Match studio name (case-insensitive, ignoring special chars)
    const inferredScenes = studio
      ? allInferredScenes.filter((scene: any) => {
          const studioNameLower = studio.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const titleLower = scene.title?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
          // Check if studio name appears in title
          return titleLower.includes(studioNameLower) || studioNameLower.includes(titleLower.split(' ')[0]);
        })
      : [];

    // Merge and deduplicate
    const allScenes = [...studioScenes];
    const sceneIds = new Set(studioScenes.map((s: any) => s.id));

    for (const scene of inferredScenes) {
      if (!sceneIds.has(scene.id)) {
        allScenes.push(scene);
        sceneIds.add(scene.id);
      }
    }

    return allScenes;
  }

  /**
   * Get download queue entry for scene
   */
  async getSceneDownloadQueue(sceneId: string) {
    return await this._db.query.downloadQueue.findFirst({
      where: (dq, { eq }) => eq(dq.sceneId, sceneId),
      orderBy: (dq, { desc }) => [desc(dq.addedAt)],
    });
  }

  /**
   * Get scene files
   */
  async getSceneFiles(sceneId: string) {
    return await this._db.query.sceneFiles.findMany({
      where: (sceneFiles, { eq }) => eq(sceneFiles.sceneId, sceneId),
    });
  }

  /**
   * Get entity name (performer name, studio name, or scene title)
   */
  async getEntityName(entityType: string, entityId: string): Promise<string> {
    if (entityType === "performer") {
      const performer = await this._db.query.performers.findFirst({
        where: (performers: any, { eq }: any) => eq(performers.id, entityId),
      });
      return performer?.name || entityId;
    } else if (entityType === "studio") {
      const studio = await this._db.query.studios.findFirst({
        where: (studios: any, { eq }: any) => eq(studios.id, entityId),
      });
      return studio?.name || entityId;
    } else if (entityType === "scene") {
      const scene = await this._db.query.scenes.findFirst({
        where: (scenes: any, { eq }: any) => eq(scenes.id, entityId),
      });
      return scene?.title || entityId;
    }
    return entityId;
  }

  /**
   * Get all scenes for a performer or studio
   * Used for auto-subscribing to scenes when subscribing to performer/studio
   */
  async getEntityScenes(entityType: "performer" | "studio", entityId: string): Promise<any[]> {
    if (entityType === "performer") {
      const performer = await this._db.query.performers.findFirst({
        where: (performers: any, { eq }: any) => eq(performers.id, entityId),
      });

      if (!performer) return [];

      // Find scenes by performer using junction table
      const performerSceneRecords = await this._db.query.performersScenes.findMany({
        where: (performersScenes: any, { eq }: any) => eq(performersScenes.performerId, performer.id),
      });

      // Get all scene IDs and fetch scenes
      const sceneIds = performerSceneRecords?.map((ps: any) => ps.sceneId) || [];
      const scenes = await Promise.all(
        sceneIds.map((sceneId: string) =>
          this._db.query.scenes.findFirst({
            where: (scenes: any, { eq }: any) => eq(scenes.id, sceneId),
          })
        )
      );
      return scenes.filter(Boolean);
    } else if (entityType === "studio") {
      const studio = await this._db.query.studios.findFirst({
        where: (studios: any, { eq }: any) => eq(studios.id, entityId),
      });

      if (!studio) return [];

      // Find scenes by studio using siteId foreign key
      return await this._db.query.scenes.findMany({
        where: (scenes: any, { eq }: any) => eq(scenes.siteId, studio.id),
      });
    }

    return [];
  }

  /**
   * Get scene relations count (performers + studios)
   * Used to determine if a scene should be soft deleted or hard deleted
   */
  async getSceneRelationsCount(sceneId: string): Promise<{ performers: number; studios: number }> {
    // Count performer relations
    const performerRelations = await this._db.query.performersScenes.findMany({
      where: (performersScenes: any, { eq }: any) => eq(performersScenes.sceneId, sceneId),
    });

    // Count studio relations (via siteId)
    const scene = await this._db.query.scenes.findFirst({
      where: (scenes: any, { eq }: any) => eq(scenes.id, sceneId),
    });

    const studioCount = scene?.siteId ? 1 : 0;

    return {
      performers: performerRelations.length,
      studios: studioCount,
    };
  }

  /**
   * Update scene isSubscribed field (soft delete)
   */
  async updateSceneIsSubscribed(sceneId: string, isSubscribed: boolean): Promise<void> {
    await this._db
      .update(scenes)
      .set({ isSubscribed })
      .where(eq(scenes.id, sceneId));
  }

  /**
   * Permanently delete a scene from database
   * This will cascade delete related records due to foreign key constraints
   */
  async deleteScene(sceneId: string): Promise<void> {
    await this._db.delete(scenes).where(eq(scenes.id, sceneId));
  }
}
