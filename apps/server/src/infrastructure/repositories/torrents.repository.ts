/**
 * Torrents Repository
 * Data access layer for torrent-related operations
 *
 * Responsibilities:
 * - Database queries only
 * - No business logic
 * - Return null for not found
 */

import type { Database } from "@repo/database";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  performers,
  studios,
  scenes,
  qualityProfiles,
  performersScenes,
  subscriptions,
  downloadQueue,
  sceneFiles,
} from "@repo/database";
import { eq, and } from "drizzle-orm";

/**
 * Scene metadata for matching
 */
export type SceneMetadata = {
  id: string;
  title: string;
  date: string | null;
  performerIds: string[];
  studioId?: string;
  performerNames?: string[];
  studioName?: string;
};

/**
 * Quality profile item from database
 */
export type QualityProfileItem = {
  quality: string;
  source: string;
  minSeeders: number | "any";
  maxSize: number;
};

/**
 * Quality profile from database
 */
export type QualityProfile = {
  id: string;
  name: string;
  items: QualityProfileItem[];
};

/**
 * Download queue item
 */
export type DownloadQueueItem = {
  id: string;
  sceneId: string;
  qbitHash: string;
  status: string;
  size: number;
  quality: string;
  completedAt: string | null;
};

/**
 * Scene file record
 */
export type SceneFile = {
  id: string;
  sceneId: string;
  filePath: string;
  size: number;
  quality: string;
  relativePath: string;
  nfoPath: string | null;
  posterPath: string | null;
};

/**
 * Repository for torrent-related database operations
 */
export class TorrentsRepository {
  private _db: BetterSQLite3Database<typeof import("@repo/database/schema")>;

  constructor({ db }: { db: Database }) {
    // Unwrap Promise - Database is Promise<DrizzleDB> but at runtime it's resolved
    this._db = db as unknown as BetterSQLite3Database<typeof import("@repo/database/schema")>;
  }

  // ============================================================
  // Entity Queries
  // ============================================================

  /**
   * Find performer by ID
   */
  async findPerformerById(id: string) {
    const performer = await this._db.query.performers.findFirst({
      where: eq(performers.id, id),
    });
    return performer ?? null;
  }

  /**
   * Find studio by ID
   */
  async findStudioById(id: string) {
    const studio = await this._db.query.studios.findFirst({
      where: eq(studios.id, id),
    });
    return studio ?? null;
  }

  /**
   * Find scene by ID
   */
  async findSceneById(id: string) {
    const scene = await this._db.query.scenes.findFirst({
      where: eq(scenes.id, id),
    });
    return scene ?? null;
  }

  // ============================================================
  // Scene Queries for Matching
  // ============================================================

  /**
   * Find scenes for a performer with subscription filtering
   */
  async findPerformerScenes(
    performerId: string,
    limit: number = 500
  ): Promise<SceneMetadata[]> {
    // Get performer-scene relations
    const performerScenes = await this._db.query.performersScenes.findMany({
      where: eq(performersScenes.performerId, performerId),
      with: {
        scene: true,
      },
      limit,
    });

    // Get all active scene-level subscriptions (whitelist approach)
    const sceneSubscriptions = await this._db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.entityType, "scene"),
        eq(subscriptions.isSubscribed, true)
      ),
    });

    const allowedSceneIds = new Set(
      sceneSubscriptions.map((s) => s.entityId)
    );

    // Only include scenes with active scene subscription
    const filteredScenes = performerScenes.filter((ps) =>
      allowedSceneIds.has(ps.scene.id)
    );

    // Fetch performer name for cross-encoder
    const performer = await this._db.query.performers.findFirst({
      where: eq(performers.id, performerId),
    });

    return filteredScenes.map((ps) => ({
      id: ps.scene.id,
      title: ps.scene.title,
      date: ps.scene.date,
      performerIds: [performerId],
      studioId: ps.scene.siteId || undefined,
      performerNames: performer ? [performer.name] : undefined,
      studioName: undefined,
    }));
  }

  /**
   * Find scenes for a studio with subscription filtering
   */
  async findStudioScenes(
    studioId: string,
    limit: number = 500
  ): Promise<SceneMetadata[]> {
    const studioScenes = await this._db.query.scenes.findMany({
      where: eq(scenes.siteId, studioId),
      limit,
    });

    // Get all active scene-level subscriptions
    const sceneSubscriptions = await this._db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.entityType, "scene"),
        eq(subscriptions.isSubscribed, true)
      ),
    });

    const allowedSceneIds = new Set(
      sceneSubscriptions.map((s) => s.entityId)
    );

    const filteredScenes = studioScenes.filter((s) =>
      allowedSceneIds.has(s.id)
    );

    // Fetch studio name
    const studio = await this._db.query.studios.findFirst({
      where: eq(studios.id, studioId),
    });

    return filteredScenes.map((s) => ({
      id: s.id,
      title: s.title,
      date: s.date,
      performerIds: [],
      studioId: s.siteId || undefined,
      performerNames: undefined,
      studioName: studio?.name,
    }));
  }

  /**
   * Find performers for a scene
   */
  async findPerformersBySceneId(sceneId: string): Promise<string[]> {
    const performerSceneRecords = await this._db.query.performersScenes.findMany({
      where: eq(performersScenes.sceneId, sceneId),
    });

    return performerSceneRecords.map((ps) => ps.performerId);
  }

  // ============================================================
  // Subscription Queries
  // ============================================================

  /**
   * Find all active scene subscriptions
   */
  async findActiveSceneSubscriptions(): Promise<
    Array<{ entityId: string; entityType: string }>
  > {
    const sceneSubscriptions = await this._db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.entityType, "scene"),
        eq(subscriptions.isSubscribed, true)
      ),
      columns: {
        entityId: true,
        entityType: true,
      },
    });

    return sceneSubscriptions;
  }

  // ============================================================
  // Quality Profile Queries
  // ============================================================

  /**
   * Find quality profile by ID
   */
  async findQualityProfileById(id: string): Promise<QualityProfile | null> {
    const profile = await this._db.query.qualityProfiles.findFirst({
      where: eq(qualityProfiles.id, id),
    });

    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      name: profile.name,
      items: (profile.items as unknown as QualityProfileItem[]) || [],
    };
  }

  // ============================================================
  // Download Queue Queries
  // ============================================================

  /**
   * Find download queue item by qBittorrent hash
   */
  async findDownloadQueueByHash(
    qbitHash: string
  ): Promise<DownloadQueueItem | null> {
    const item = await this._db.query.downloadQueue.findFirst({
      where: eq(downloadQueue.qbitHash, qbitHash),
    });

    if (!item) {
      return null;
    }

    return {
      id: item.id,
      sceneId: item.sceneId,
      qbitHash: item.qbitHash ?? "",
      status: item.status,
      size: item.size,
      quality: item.quality,
      completedAt: item.completedAt,
    };
  }

  /**
   * Find download queue item by hash (alias for findDownloadQueueByHash)
   */
  async findDownloadQueueItemByHash(
    qbitHash: string
  ): Promise<DownloadQueueItem | null> {
    return this.findDownloadQueueByHash(qbitHash);
  }

  /**
   * Update download queue item status to completed
   */
  async updateDownloadQueueCompleted(
    id: string,
    completedAt: string
  ): Promise<void> {
    await this._db
      .update(downloadQueue)
      .set({
        status: "completed",
        completedAt,
      })
      .where(eq(downloadQueue.id, id));
  }

  /**
   * Update download queue status (simplified version)
   */
  async updateDownloadQueueStatus(
    id: string,
    status: string
  ): Promise<void> {
    const updateData: { status: string; completedAt?: string } = { status };
    if (status === "completed") {
      updateData.completedAt = new Date().toISOString();
    }
    await this._db
      .update(downloadQueue)
      .set(updateData)
      .where(eq(downloadQueue.id, id));
  }

  // ============================================================
  // Scene Files Queries
  // ============================================================

  /**
   * Find scene file by scene ID
   */
  async findSceneFileBySceneId(sceneId: string): Promise<SceneFile | null> {
    const sceneFile = await this._db.query.sceneFiles.findFirst({
      where: eq(sceneFiles.sceneId, sceneId),
    });

    if (!sceneFile) {
      return null;
    }

    return {
      id: sceneFile.id,
      sceneId: sceneFile.sceneId,
      filePath: sceneFile.filePath,
      size: sceneFile.size,
      quality: sceneFile.quality,
      relativePath: sceneFile.relativePath,
      nfoPath: sceneFile.nfoPath,
      posterPath: sceneFile.posterPath,
    };
  }

  /**
   * Create new scene file record
   */
  async createSceneFile(data: {
    sceneId: string;
    filePath: string;
    size: number;
    quality: string;
    relativePath: string;
    nfoPath?: string | null;
    posterPath?: string | null;
  }): Promise<void> {
    await this._db.insert(sceneFiles).values({
      id: crypto.randomUUID(),
      ...data,
    });
  }

  /**
   * Update existing scene file record
   */
  async updateSceneFile(
    id: string,
    data: {
      filePath?: string;
      nfoPath?: string | null;
      posterPath?: string | null;
    }
  ): Promise<void> {
    await this._db
      .update(sceneFiles)
      .set(data)
      .where(eq(sceneFiles.id, id));
  }

  /**
   * Update or insert scene file record
   */
  async upsertSceneFile(
    sceneId: string,
    data: {
      filePath: string;
      size: number;
      quality: string;
      relativePath: string;
      nfoPath?: string | null;
      posterPath?: string | null;
    }
  ): Promise<void> {
    const existing = await this.findSceneFileBySceneId(sceneId);

    if (existing) {
      await this.updateSceneFile(existing.id, {
        filePath: data.filePath,
        nfoPath: data.nfoPath,
        posterPath: data.posterPath,
      });
    } else {
      await this.createSceneFile({
        sceneId,
        ...data,
      });
    }
  }

  /**
   * Update or insert scene file record (handler-friendly version)
   */
  async upsertSceneFileFromCompletion(data: {
    sceneId: string;
    filePath?: string | null;
    size?: number;
    quality?: string;
    destinationPath?: string;
    nfoPath?: string | null;
    posterPath?: string | null;
  }): Promise<void> {
    const existing = await this.findSceneFileBySceneId(data.sceneId);

    if (existing) {
      await this.updateSceneFile(existing.id, {
        filePath: data.filePath || existing.filePath,
        nfoPath: data.nfoPath,
        posterPath: data.posterPath,
      });
    } else if (data.filePath) {
      // Create new record only if filePath is provided
      await this.createSceneFile({
        sceneId: data.sceneId,
        filePath: data.filePath,
        size: data.size || 0,
        quality: data.quality || "unknown",
        relativePath: data.destinationPath
          ? data.filePath.replace(data.destinationPath, "")
          : data.filePath,
        nfoPath: data.nfoPath,
        posterPath: data.posterPath,
      });
    }
  }
}

/**
 * Factory function for creating TorrentsRepository
 */
export function createTorrentsRepository(
  db: Database
): TorrentsRepository {
  return new TorrentsRepository({ db });
}
