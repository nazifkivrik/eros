import type { Logger } from "pino";
import type { Database } from "@repo/database";
import { eq, count, sum, sql } from "drizzle-orm";
import { scenes, performers, studios, sceneFiles, downloadQueue } from "@repo/database";
import type { FileManagerService } from "./file-management/file-manager.service.js";
import type { MetadataProviderRegistry, IndexerRegistry, TorrentClientRegistry } from "@/infrastructure/registries/provider-registry.js";
import type { SettingsRepository } from "@/infrastructure/repositories/settings.repository.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Provider status for dashboard
 */
export interface ProviderStatus {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
}

export interface ProviderStatusResponse {
  metadataProviders: ProviderStatus[];
  indexers: ProviderStatus[];
  torrentClients: ProviderStatus[];
}

export interface StorageVolume {
  path: string;
  name: string;
  total: number;
  used: number;
  available: number;
  usagePercentage: number;
}

export interface DashboardStatistics {
  storage: {
    totalDiskSpace: number;
    usedDiskSpace: number;
    availableDiskSpace: number;
    contentSize: number;
    usagePercentage: number;
    volumes: StorageVolume[];
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
  private settingsRepository: SettingsRepository;
  private metadataRegistry: MetadataProviderRegistry;
  private indexerRegistry: IndexerRegistry;
  private torrentClientRegistry: TorrentClientRegistry;

  constructor({
    db,
    fileManager,
    logger,
    settingsRepository,
    metadataRegistry,
    indexerRegistry,
    torrentClientRegistry,
  }: {
    db: Database;
    fileManager: FileManagerService;
    logger: Logger;
    settingsRepository: SettingsRepository;
    metadataRegistry: MetadataProviderRegistry;
    indexerRegistry: IndexerRegistry;
    torrentClientRegistry: TorrentClientRegistry;
  }) {
    this.db = db;
    this.fileManager = fileManager;
    this.logger = logger;
    this.settingsRepository = settingsRepository;
    this.metadataRegistry = metadataRegistry;
    this.indexerRegistry = indexerRegistry;
    this.torrentClientRegistry = torrentClientRegistry;
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
   * Supports multiple download paths/volumes
   */
  private async getStorageMetrics(): Promise<DashboardStatistics["storage"]> {
    try {
      // Get content size from DB
      const [contentSizeResult] = await this.db
        .select({ total: sum(sceneFiles.size) })
        .from(sceneFiles);
      const contentSize = Number(contentSizeResult?.total || 0);

      // Get settings to find download paths
      const settings = await this.settingsRepository.getSettings();
      const downloadPaths = settings.downloadPaths?.paths || [];

      // Build list of paths to check - use download paths or fallback to root
      const pathsToCheck: string[] = [];

      // First try the configured download paths
      for (const dp of downloadPaths) {
        if (dp.path) {
          pathsToCheck.push(dp.path);
        }
      }

      // Always add root filesystem as fallback (will only be used if others fail)
      pathsToCheck.push("/");

      // Get disk stats for each unique path
      const uniquePaths = Array.from(new Set(pathsToCheck));
      const volumeStats: StorageVolume[] = [];

      let totalDiskSpace = 0;
      let usedDiskSpace = 0;
      let availableDiskSpace = 0;

      for (const path of uniquePaths) {
        try {
          // Use LC_ALL=C to ensure English output for consistent parsing
          const { stdout } = await execAsync(`LC_ALL=C df -B1 "${path}" 2>/dev/null`);
          const lines = stdout.trim().split("\n");

          // Skip header, use first data line
          const data = lines[1]?.split(/\s+/);
          if (!data || data.length < 4) {
            this.logger.warn({ path, stdout }, "Failed to parse df output for path");
            continue;
          }

          const total = parseInt(data[1], 10);
          const used = parseInt(data[2], 10);
          const available = parseInt(data[3], 10);
          const usagePercentage = total > 0 ? (used / total) * 100 : 0;

          // Find the corresponding download path config for the name
          const downloadPath = downloadPaths.find(p => p.path === path);
          const name = downloadPath?.name || (path === "/" ? "Root Filesystem" : path);

          volumeStats.push({
            path,
            name,
            total,
            used,
            available,
            usagePercentage,
          });

          // For root filesystem, use its values directly
          // For other paths, only add if they're on a different filesystem
          // For simplicity, we'll just use the first successful result (usually the configured download paths)
          if (volumeStats.length === 1 || path === "/") {
            totalDiskSpace = total;
            usedDiskSpace = used;
            availableDiskSpace = available;
          }

          this.logger.info({ path, total, used, available }, "Successfully retrieved disk stats");

        } catch (error) {
          this.logger.warn({ path, error }, `Failed to get disk stats for path`);
        }
      }

      // If no volumes were successfully retrieved, return zeros
      if (volumeStats.length === 0) {
        return {
          totalDiskSpace: 0,
          usedDiskSpace: 0,
          availableDiskSpace: 0,
          contentSize,
          usagePercentage: 0,
          volumes: [],
        };
      }

      // Calculate overall usage percentage
      const usagePercentage = totalDiskSpace > 0 ? (usedDiskSpace / totalDiskSpace) * 100 : 0;

      return {
        totalDiskSpace,
        usedDiskSpace,
        availableDiskSpace,
        contentSize,
        usagePercentage,
        volumes: volumeStats,
      };
    } catch (error) {
      this.logger.error({ error }, "Failed to get disk stats");
      return {
        totalDiskSpace: 0,
        usedDiskSpace: 0,
        availableDiskSpace: 0,
        contentSize: 0,
        usagePercentage: 0,
        volumes: [],
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

  /**
   * Get provider status for all configured providers
   * Returns enabled providers with their connection status
   */
  async getProviderStatus(): Promise<ProviderStatusResponse> {
    this.logger.debug("Fetching provider status");

    const settings = await this.settingsRepository.getSettings();
    const providers = settings.providers;

    // Get metadata provider status
    const metadataProviders: ProviderStatus[] = providers.metadata.map((provider) => {
      const isRegistered = this.metadataRegistry.get(provider.id);
      const isAvailable = isRegistered ? this.metadataRegistry.isAvailable(provider.id) : false;

      return {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        enabled: provider.enabled,
        status: this.getProviderStatusValue(provider.enabled, isRegistered, isAvailable),
      };
    });

    // Get indexer status
    const indexers: ProviderStatus[] = providers.indexers.map((provider) => {
      const isRegistered = this.indexerRegistry.get(provider.id);
      const isAvailable = isRegistered ? this.indexerRegistry.isAvailable(provider.id) : false;

      return {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        enabled: provider.enabled,
        status: this.getProviderStatusValue(provider.enabled, isRegistered, isAvailable),
      };
    });

    // Get torrent client status
    const torrentClients: ProviderStatus[] = providers.torrentClients.map((provider) => {
      const isRegistered = this.torrentClientRegistry.get(provider.id);
      const isAvailable = isRegistered ? this.torrentClientRegistry.isAvailable(provider.id) : false;

      return {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        enabled: provider.enabled,
        status: this.getProviderStatusValue(provider.enabled, isRegistered, isAvailable),
      };
    });

    return {
      metadataProviders,
      indexers,
      torrentClients,
    };
  }

  /**
   * Determine provider status based on enabled, registered, and available states
   */
  private getProviderStatusValue(
    enabled: boolean,
    isRegistered: boolean,
    isAvailable: boolean
  ): "connected" | "disconnected" | "error" {
    if (!enabled) {
      return "disconnected";
    }
    if (!isRegistered) {
      return "error";
    }
    if (!isAvailable) {
      return "error";
    }
    return "connected";
  }
}
