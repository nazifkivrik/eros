import type { Logger } from "pino";
import type { Database } from "@repo/database";
import { eq, count, sum, sql } from "drizzle-orm";
import { scenes, performers, studios, sceneFiles, downloadQueue } from "@repo/database";
import type { FileManagerService } from "./file-management/file-manager.service.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface DashboardStatistics {
  storage: {
    totalDiskSpace: number;
    usedDiskSpace: number;
    availableDiskSpace: number;
    contentSize: number;
    usagePercentage: number;
  };
  content: {
    totalScenes: number;
    scenesWithFiles: number;
    totalFiles: number;
    totalContentSize: number;
    topStudios: Array<{ name: string; count: number; size: number }>;
    qualityDistribution: Array<{ quality: string; count: number; size: number }>;
  };
  activeDownloads: number;
  queuedDownloads: number;
  completedDownloads: number;
  failedDownloads: number;
}

/**
 * Dashboard Statistics Service
 * Business logic for aggregating dashboard metrics
 */
export class DashboardService {
  private db: Database;
  private fileManager: FileManagerService;
  private logger: Logger;

  constructor({
    db,
    fileManager,
    logger,
  }: {
    db: Database;
    fileManager: FileManagerService;
    logger: Logger;
  }) {
    this.db = db;
    this.fileManager = fileManager;
    this.logger = logger;
  }

  async getDashboardStatistics(): Promise<DashboardStatistics> {
    this.logger.debug("Fetching dashboard statistics");

    const [storage, content, downloadStats] = await Promise.all([
      this.getStorageMetrics(),
      this.getContentStatistics(),
      this.getDownloadStatistics(),
    ]);

    return {
      storage,
      content,
      ...downloadStats,
    };
  }

  /**
   * Get storage metrics
   * Uses filesystem stats + database aggregation
   */
  private async getStorageMetrics(): Promise<DashboardStatistics["storage"]> {
    // Use df command for disk stats
    try {
      // Try to get disk stats for /media path
      const { stdout } = await execAsync("df -B1 /media 2>/dev/null || df -B1 /");

      const lines = stdout.trim().split("\n");
      // Skip header, use first data line
      const data = lines[1]?.split(/\s+/);
      if (!data || data.length < 4) {
        throw new Error("Failed to parse df output");
      }

      const total = parseInt(data[1], 10);
      const used = parseInt(data[2], 10);
      const available = parseInt(data[3], 10);

      // Get content size from DB
      const [contentSizeResult] = await this.db
        .select({ total: sum(sceneFiles.size) })
        .from(sceneFiles);

      const contentSize = Number(contentSizeResult?.total || 0);

      return {
        totalDiskSpace: total,
        usedDiskSpace: used,
        availableDiskSpace: available,
        contentSize,
        usagePercentage: total > 0 ? (used / total) * 100 : 0,
      };
    } catch (error) {
      this.logger.error({ error }, "Failed to get disk stats");
      return {
        totalDiskSpace: 0,
        usedDiskSpace: 0,
        availableDiskSpace: 0,
        contentSize: 0,
        usagePercentage: 0,
      };
    }
  }

  /**
   * Get content statistics with aggregations
   */
  private async getContentStatistics(): Promise<DashboardStatistics["content"]> {
    // Total scenes
    const [totalScenesResult] = await this.db
      .select({ count: count() })
      .from(scenes);

    // Scenes with files
    const [scenesWithFilesResult] = await this.db
      .select({ count: count(sql<number>`distinct ${sceneFiles.sceneId}`) })
      .from(sceneFiles);

    // Total files and size
    const [filesStats] = await this.db
      .select({
        totalFiles: count(),
        totalContentSize: sum(sceneFiles.size),
      })
      .from(sceneFiles);

    const totalScenes = totalScenesResult?.count || 0;
    const scenesWithFiles = scenesWithFilesResult?.count || 0;
    const totalFiles = filesStats?.totalFiles || 0;
    const totalContentSize = filesStats?.totalContentSize || 0;

    // Top studios by content size
    const topStudiosResult = await this.db
      .select({
        name: studios.name,
        count: count(sql<number>`distinct ${sceneFiles.sceneId}`),
        size: sum(sceneFiles.size),
      })
      .from(sceneFiles)
      .innerJoin(scenes, eq(sceneFiles.sceneId, scenes.id))
      .innerJoin(studios, eq(scenes.siteId, studios.id))
      .groupBy(studios.id, studios.name)
      .limit(10);

    // Quality distribution
    const qualityDistResult = await this.db
      .select({
        quality: sceneFiles.quality,
        count: count(),
        size: sum(sceneFiles.size),
      })
      .from(sceneFiles)
      .groupBy(sceneFiles.quality);

    return {
      totalScenes,
      scenesWithFiles,
      totalFiles,
      totalContentSize: Number(totalContentSize) || 0,
      topStudios: topStudiosResult.map((s: any) => ({
        name: s.name || "Unknown",
        count: Number(s.count) || 0,
        size: Number(s.size) || 0,
      })),
      qualityDistribution: qualityDistResult.map((q: any) => ({
        quality: q.quality,
        count: Number(q.count) || 0,
        size: Number(q.size) || 0,
      })),
    };
  }

  /**
   * Get download statistics
   */
  private async getDownloadStatistics(): Promise<
    Omit<DashboardStatistics, "storage" | "content">
  > {
    const stats = await this.db
      .select({
        status: downloadQueue.status,
        count: count(),
      })
      .from(downloadQueue)
      .groupBy(downloadQueue.status);

    const statsMap = new Map(stats.map((s) => [s.status, s.count]));

    return {
      activeDownloads: statsMap.get("downloading") || 0,
      queuedDownloads: statsMap.get("queued") || 0,
      completedDownloads: statsMap.get("completed") || 0,
      failedDownloads:
        (statsMap.get("failed") || 0) + (statsMap.get("add_failed") || 0),
    };
  }
}
