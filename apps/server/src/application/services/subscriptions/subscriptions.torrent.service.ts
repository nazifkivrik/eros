import type { Logger } from "pino";
import type { ITorrentClient } from "@/infrastructure/adapters/interfaces/torrent-client.interface.js";
import type { SubscriptionsRepository } from "@/infrastructure/repositories/subscriptions.repository.js";
import type { QualityProfilesRepository } from "@/infrastructure/repositories/quality-profiles.repository.js";
import type { TorrentSearchService } from "@/application/services/torrent-search/index.js";
import type { DownloadService } from "@/application/services/torrent-selection/download.service.js";
import { eq } from "drizzle-orm";
import { subscriptions, scenes, downloadQueue } from "@repo/database";
import type { Database } from "@repo/database";

/**
 * Add Torrent Result
 */
export interface AddTorrentResult {
  success: boolean;
  hash: string | null;
  error: string | null;
}

/**
 * Torrent Status
 */
export interface TorrentStatus {
  hash: string;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  state: string;
  paused: boolean;
}

/**
 * Auto Download Result
 */
export interface AutoDownloadResult {
  success: boolean;
  hash: string | null;
  matched: boolean;
  reason: string | null;
}

/**
 * Subscriptions Torrent Service
 * Handles torrent operations for subscriptions
 * Uses ITorrentClient adapter for qBittorrent integration
 */
export class SubscriptionsTorrentService {
  private torrentClient: ITorrentClient | undefined;
  private subscriptionsRepository: SubscriptionsRepository;
  private qualityProfilesRepository: QualityProfilesRepository;
  private torrentSearchService: TorrentSearchService;
  private downloadService: DownloadService;
  private db: Database;
  private logger: Logger;

  constructor({
    torrentClient,
    subscriptionsRepository,
    qualityProfilesRepository,
    torrentSearchService,
    downloadService,
    db,
    logger,
  }: {
    torrentClient: ITorrentClient | undefined;
    subscriptionsRepository: SubscriptionsRepository;
    qualityProfilesRepository: QualityProfilesRepository;
    torrentSearchService: TorrentSearchService;
    downloadService: DownloadService;
    db: Database;
    logger: Logger;
  }) {
    this.torrentClient = torrentClient;
    this.subscriptionsRepository = subscriptionsRepository;
    this.qualityProfilesRepository = qualityProfilesRepository;
    this.torrentSearchService = torrentSearchService;
    this.downloadService = downloadService;
    this.db = db;
    this.logger = logger;
  }

  /**
   * Add torrent to download client for a scene subscription
   */
  async addTorrentForScene(
    subscriptionId: string,
    magnetLink: string
  ): Promise<AddTorrentResult> {
    this.logger.info({ subscriptionId }, "Adding torrent for scene subscription");

    if (!this.torrentClient) {
      return {
        success: false,
        hash: null,
        error: "Torrent client not configured",
      };
    }

    try {
      // Get subscription
      const subscription = await this.subscriptionsRepository.findById(subscriptionId);
      if (!subscription) {
        return {
          success: false,
          hash: null,
          error: "Subscription not found",
        };
      }

      // Only scene subscriptions can download torrents
      if (subscription.entityType !== "scene") {
        return {
          success: false,
          hash: null,
          error: "Only scene subscriptions can download torrents",
        };
      }

      // Get scene for folder naming
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, subscription.entityId),
      });

      if (!scene) {
        return {
          success: false,
          hash: null,
          error: "Scene not found",
        };
      }

      // Use torrent client to add magnet
      const hash = await this.torrentClient?.addMagnet(magnetLink);

      if (!hash) {
        return {
          success: false,
          hash: null,
          error: "Failed to add torrent to client",
        };
      }

      this.logger.info({ subscriptionId, hash }, "Torrent added successfully");

      return {
        success: true,
        hash,
        error: null,
      };
    } catch (error) {
      this.logger.error({ error, subscriptionId }, "Failed to add torrent");

      return {
        success: false,
        hash: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Pause torrent download for a scene subscription
   */
  async pauseTorrentForScene(subscriptionId: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    this.logger.info({ subscriptionId }, "Pausing torrent for scene subscription");

    if (!this.torrentClient) {
      return {
        success: false,
        error: "Torrent client not configured",
      };
    }

    try {
      // Get subscription
      const subscription = await this.subscriptionsRepository.findById(subscriptionId);
      if (!subscription) {
        return {
          success: false,
          error: "Subscription not found",
        };
      }

      if (subscription.entityType !== "scene") {
        return {
          success: false,
          error: "Only scene subscriptions have torrents",
        };
      }

      // Get scene to find torrent hash
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, subscription.entityId),
      });

      if (!scene) {
        return {
          success: false,
          error: "Scene not found",
        };
      }

      // Get download queue entry for this scene
      const queueEntry = await this.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.sceneId, scene.id),
      });

      if (!queueEntry || !queueEntry.torrentHash) {
        return {
          success: false,
          error: "Scene has no associated torrent",
        };
      }

      // Pause torrent using adapter
      await this.torrentClient.pauseTorrent(queueEntry.torrentHash);

      this.logger.info({ subscriptionId, hash: queueEntry.torrentHash }, "Torrent paused");

      return {
        success: true,
        error: null,
      };
    } catch (error) {
      this.logger.error({ error, subscriptionId }, "Failed to pause torrent");

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Resume torrent download for a scene subscription
   */
  async resumeTorrentForScene(subscriptionId: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    this.logger.info({ subscriptionId }, "Resuming torrent for scene subscription");

    if (!this.torrentClient) {
      return {
        success: false,
        error: "Torrent client not configured",
      };
    }

    try {
      // Get subscription
      const subscription = await this.subscriptionsRepository.findById(subscriptionId);
      if (!subscription) {
        return {
          success: false,
          error: "Subscription not found",
        };
      }

      if (subscription.entityType !== "scene") {
        return {
          success: false,
          error: "Only scene subscriptions have torrents",
        };
      }

      // Get scene to find torrent hash
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, subscription.entityId),
      });

      if (!scene) {
        return {
          success: false,
          error: "Scene not found",
        };
      }

      // Get download queue entry for this scene
      const queueEntry = await this.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.sceneId, scene.id),
      });

      if (!queueEntry || !queueEntry.torrentHash) {
        return {
          success: false,
          error: "Scene has no associated torrent",
        };
      }

      // Resume torrent using adapter
      await this.torrentClient.resumeTorrent(queueEntry.torrentHash);

      this.logger.info({ subscriptionId, hash: queueEntry.torrentHash }, "Torrent resumed");

      return {
        success: true,
        error: null,
      };
    } catch (error) {
      this.logger.error({ error, subscriptionId }, "Failed to resume torrent");

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Remove torrent for a scene subscription
   */
  async removeTorrentForScene(
    subscriptionId: string,
    deleteFiles: boolean = false
  ): Promise<{
    success: boolean;
    error: string | null;
  }> {
    this.logger.info({ subscriptionId, deleteFiles }, "Removing torrent for scene subscription");

    if (!this.torrentClient) {
      return {
        success: false,
        error: "Torrent client not configured",
      };
    }

    try {
      // Get subscription
      const subscription = await this.subscriptionsRepository.findById(subscriptionId);
      if (!subscription) {
        return {
          success: false,
          error: "Subscription not found",
        };
      }

      if (subscription.entityType !== "scene") {
        return {
          success: false,
          error: "Only scene subscriptions have torrents",
        };
      }

      // Get scene to find torrent hash
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, subscription.entityId),
      });

      if (!scene) {
        return {
          success: false,
          error: "Scene not found",
        };
      }

      // Get download queue entry for this scene
      const queueEntry = await this.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.sceneId, scene.id),
      });

      if (!queueEntry || !queueEntry.torrentHash) {
        return {
          success: false,
          error: "Scene has no associated torrent",
        };
      }

      // Remove torrent using adapter
      await this.torrentClient.removeTorrent(queueEntry.torrentHash, deleteFiles);

      // Delete download queue entry
      await this.db
        .delete(downloadQueue)
        .where(eq(downloadQueue.sceneId, scene.id));

      this.logger.info({ subscriptionId, hash: queueEntry.torrentHash, deleteFiles }, "Torrent removed");

      return {
        success: true,
        error: null,
      };
    } catch (error) {
      this.logger.error({ error, subscriptionId }, "Failed to remove torrent");

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get torrent status for a scene subscription
   */
  async getTorrentStatus(subscriptionId: string): Promise<{
    status: TorrentStatus | null;
    error: string | null;
  }> {
    this.logger.info({ subscriptionId }, "Getting torrent status for scene subscription");

    if (!this.torrentClient) {
      return {
        status: null,
        error: "Torrent client not configured",
      };
    }

    try {
      // Get subscription
      const subscription = await this.subscriptionsRepository.findById(subscriptionId);
      if (!subscription) {
        return {
          status: null,
          error: "Subscription not found",
        };
      }

      if (subscription.entityType !== "scene") {
        return {
          status: null,
          error: "Only scene subscriptions have torrents",
        };
      }

      // Get scene to find torrent hash
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, subscription.entityId),
      });

      if (!scene) {
        return {
          status: null,
          error: "Scene not found",
        };
      }

      // Get download queue entry for this scene
      const queueEntry = await this.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.sceneId, scene.id),
      });

      if (!queueEntry || !queueEntry.torrentHash) {
        return {
          status: null,
          error: "Scene has no associated torrent",
        };
      }

      // Get torrent info from client
      const torrentInfo = await this.torrentClient.getTorrentInfo(queueEntry.torrentHash);

      if (!torrentInfo) {
        return {
          status: null,
          error: "Torrent not found in client",
        };
      }

      const status: TorrentStatus = {
        hash: torrentInfo.hash,
        name: torrentInfo.name,
        size: torrentInfo.size,
        progress: torrentInfo.progress,
        downloadSpeed: torrentInfo.downloadSpeed,
        uploadSpeed: torrentInfo.uploadSpeed,
        eta: torrentInfo.eta,
        state: torrentInfo.state,
        paused: torrentInfo.state === "paused" || torrentInfo.state === "stalledUP",
      };

      return {
        status,
        error: null,
      };
    } catch (error) {
      this.logger.error({ error, subscriptionId }, "Failed to get torrent status");

      return {
        status: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Auto-download scene based on quality profile settings
   * Searches for matching torrent and adds it to download client
   */
  async autoDownloadScene(sceneId: string): Promise<AutoDownloadResult> {
    this.logger.info({ sceneId }, "Auto-downloading scene");

    if (!this.torrentClient) {
      return {
        success: false,
        hash: null,
        matched: false,
        reason: "Torrent client not configured",
      };
    }

    try {
      // Get scene
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, sceneId),
      });

      if (!scene) {
        return {
          success: false,
          hash: null,
          matched: false,
          reason: "Scene not found",
        };
      }

      // Check if scene already has a torrent in download queue
      const existingEntry = await this.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.sceneId, sceneId),
      });

      if (existingEntry && existingEntry.torrentHash) {
        return {
          success: true,
          hash: existingEntry.torrentHash,
          matched: true,
          reason: "Already downloading",
        };
      }

      // Find subscription for this scene
      const subscription = await this.db.query.subscriptions.findFirst({
        where: eq(subscriptions.entityId, sceneId),
      });

      if (!subscription || subscription.entityType !== "scene") {
        return {
          success: false,
          hash: null,
          matched: false,
          reason: "No scene subscription found",
        };
      }

      // Check if auto-download is enabled
      if (!subscription.autoDownload) {
        return {
          success: false,
          hash: null,
          matched: false,
          reason: "Auto-download not enabled for subscription",
        };
      }

      // Get quality profile
      const qualityProfile = await this.qualityProfilesRepository.findById(
        subscription.qualityProfileId
      );

      if (!qualityProfile) {
        return {
          success: false,
          hash: null,
          matched: false,
          reason: "Quality profile not found",
        };
      }

      // Search for torrents using TorrentSearchService
      // NOTE: This functionality needs to be refactored to work with the new TorrentSearchService API
      // The old searchTorrents() method is not available in the new service
      // For now, return an error indicating this needs to be implemented
      return {
        success: false,
        hash: null,
        matched: false,
        reason: "Auto-download not yet implemented with new torrent search architecture",
      };

      /* Old implementation (disabled):
      const searchQuery = `${scene.title} ${scene.date || ""}`.trim();
      const searchResults = await this.torrentSearchService.searchTorrents(
        searchQuery,
        qualityProfile.items
      );

      if (!searchResults || searchResults.length === 0) {
        return {
          success: false,
          hash: null,
          matched: false,
          reason: "No matching torrents found",
        };
      }

      // Use first (best) result
      const bestMatch = searchResults[0];

      // Add torrent using DownloadService
      const downloadResult = await this.downloadService.addMagnet(bestMatch.magnetLink, {
        sceneId: scene.id,
        savePath: qualityProfile.savePath,
      });

      if (downloadResult.success && downloadResult.hash) {
        // Update scene with torrent hash
        await this.db
          .update(scenes)
          .set({ torrentHash: downloadResult.hash })
          .where(eq(scenes.id, scene.id));

        this.logger.info(
          { sceneId, hash: downloadResult.hash, torrent: bestMatch.title },
          "Scene auto-downloaded successfully"
        );

        return {
          success: true,
          hash: downloadResult.hash,
          matched: true,
          reason: null,
        };
      } else {
        return {
          success: false,
          hash: null,
          matched: true,
          reason: downloadResult.error || "Failed to add torrent",
        };
      }
      */
    } catch (error) {
      this.logger.error({ error, sceneId }, "Failed to auto-download scene");

      return {
        success: false,
        hash: null,
        matched: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
