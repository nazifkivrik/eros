import type { Database } from "@repo/database";
import { torrentGroups } from "@repo/database/schema";
import { nanoid } from "nanoid";
import { eq, and, isNull, desc } from "drizzle-orm";

/**
 * Torrent Groups Repository
 * Handles CRUD operations for torrent grouping and discovery logic
 */
export class TorrentGroupsRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Create a new torrent group
   * Used during discovery phase when multiple indexers have similar torrents
   */
  async create(data: {
    groupTitle: string;
    rawTitles: string[];
    sceneId?: string;
    torrentCount: number;
    indexerCount: number;
    status: "matched" | "unknown" | "ignored";
    aiScore?: number;
    searchPhase?: "performer" | "studio" | "targeted";
  }) {
    const id = nanoid();
    const now = new Date().toISOString();

    await this.db.insert(torrentGroups).values({
      id,
      groupTitle: data.groupTitle,
      rawTitles: data.rawTitles,
      sceneId: data.sceneId || null,
      torrentCount: data.torrentCount,
      indexerCount: data.indexerCount,
      status: data.status,
      aiScore: data.aiScore || null,
      searchPhase: data.searchPhase || null,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  }

  /**
   * Update a torrent group with matched scene information
   * Called when a previously unknown group is matched to a scene
   */
  async updateWithScene(groupId: string, sceneId: string, aiScore: number) {
    await this.db
      .update(torrentGroups)
      .set({
        sceneId,
        aiScore,
        status: "matched",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(torrentGroups.id, groupId));
  }

  /**
   * Get a torrent group by ID
   */
  async findById(id: string) {
    return this.db.query.torrentGroups.findFirst({
      where: eq(torrentGroups.id, id),
    });
  }

  /**
   * Get all unknown torrent groups
   * These are groups that haven't been matched to scenes yet
   * Useful for metadata discovery job
   */
  async findUnknownGroups(limit = 100) {
    return this.db.query.torrentGroups.findMany({
      where: and(
        eq(torrentGroups.status, "unknown"),
        isNull(torrentGroups.sceneId)
      ),
      orderBy: [desc(torrentGroups.createdAt)],
      limit,
    });
  }

  /**
   * Get torrent groups by status
   */
  async findByStatus(status: "matched" | "unknown" | "ignored", limit = 100) {
    return this.db.query.torrentGroups.findMany({
      where: eq(torrentGroups.status, status),
      orderBy: [desc(torrentGroups.createdAt)],
      limit,
    });
  }

  /**
   * Get torrent groups by search phase
   * Useful for analyzing which phase finds most content
   */
  async findBySearchPhase(
    phase: "performer" | "studio" | "targeted",
    limit = 100
  ) {
    return this.db.query.torrentGroups.findMany({
      where: eq(torrentGroups.searchPhase, phase),
      orderBy: [desc(torrentGroups.createdAt)],
      limit,
    });
  }

  /**
   * Get groups for a specific scene
   */
  async findByScene(sceneId: string) {
    return this.db.query.torrentGroups.findMany({
      where: eq(torrentGroups.sceneId, sceneId),
      orderBy: [desc(torrentGroups.createdAt)],
    });
  }

  /**
   * Update group status (e.g., mark as ignored)
   */
  async updateStatus(groupId: string, status: "matched" | "unknown" | "ignored") {
    await this.db
      .update(torrentGroups)
      .set({
        status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(torrentGroups.id, groupId));
  }

  /**
   * Get statistics about torrent groups
   */
  async getGroupStats() {
    const allGroups = await this.db.query.torrentGroups.findMany();

    const stats = {
      total: allGroups.length,
      byStatus: {
        matched: 0,
        unknown: 0,
        ignored: 0,
      },
      byPhase: {
        performer: 0,
        studio: 0,
        targeted: 0,
      },
      avgIndexerCount: 0,
      avgTorrentCount: 0,
    };

    let totalIndexers = 0;
    let totalTorrents = 0;

    for (const group of allGroups) {
      // Count by status
      stats.byStatus[group.status]++;

      // Count by phase
      if (group.searchPhase) {
        stats.byPhase[group.searchPhase]++;
      }

      // Sum for averages
      totalIndexers += group.indexerCount;
      totalTorrents += group.torrentCount;
    }

    // Calculate averages
    if (allGroups.length > 0) {
      stats.avgIndexerCount = totalIndexers / allGroups.length;
      stats.avgTorrentCount = totalTorrents / allGroups.length;
    }

    return stats;
  }

  /**
   * Delete a torrent group
   */
  async delete(groupId: string) {
    await this.db.delete(torrentGroups).where(eq(torrentGroups.id, groupId));
  }

  /**
   * Get recent groups (for monitoring)
   */
  async getRecentGroups(limit = 50) {
    return this.db.query.torrentGroups.findMany({
      orderBy: [desc(torrentGroups.createdAt)],
      limit,
    });
  }
}
