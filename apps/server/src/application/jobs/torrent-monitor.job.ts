/**
 * Torrent Monitor Job
 * Monitors qBittorrent status and manages stalled torrents
 * Runs every 5 minutes
 */

import { BaseJob } from "./base.job.js";
import type { Logger } from "pino";
import type { JobProgressService } from "@/infrastructure/job-progress.service.js";
import type { DownloadQueueRepository } from "@/infrastructure/repositories/download-queue.repository.js";
import type { TorrentCompletionHandlerService } from "../../application/services/torrent-completion/torrent-completion.handler.service.js";
import type { TorrentClientRegistry } from "@/infrastructure/registries/provider-registry.js";
import type { ITorrentClient } from "@/infrastructure/adapters/interfaces/torrent-client.interface.js";
import type { SettingsService } from "../../application/services/settings.service.js";
import type { SpeedProfileService } from "../../application/services/speed-profile.service.js";
import type { DownloadQueueService } from "../../application/services/download-queue.service.js";
import type { TorrentManagementService } from "../../application/services/torrent-management.service.js";
import type { Database } from "@repo/database";
import { eq, inArray, lt, and } from "drizzle-orm";
import { downloadQueue } from "@repo/database";

export class TorrentMonitorJob extends BaseJob {
  readonly name = "torrent-monitor";
  readonly description = "Monitor torrent downloads and handle completions";

  private downloadQueueRepository: DownloadQueueRepository;
  private torrentCompletionService: TorrentCompletionHandlerService;
  private torrentClientRegistry: TorrentClientRegistry;
  private settingsService: SettingsService;
  private speedProfileService: SpeedProfileService;
  private downloadQueueService: DownloadQueueService;
  private torrentManagementService: TorrentManagementService;
  private db: Database;

  constructor(deps: {
    logger: Logger;
    jobProgressService: JobProgressService;
    downloadQueueRepository: DownloadQueueRepository;
    torrentCompletionService: TorrentCompletionHandlerService;
    torrentClientRegistry: TorrentClientRegistry;
    settingsService: SettingsService;
    speedProfileService: SpeedProfileService;
    downloadQueueService: DownloadQueueService;
    torrentManagementService: TorrentManagementService;
    db: Database;
  }) {
    super(deps);
    this.downloadQueueRepository = deps.downloadQueueRepository;
    this.torrentCompletionService = deps.torrentCompletionService;
    this.torrentClientRegistry = deps.torrentClientRegistry;
    this.settingsService = deps.settingsService;
    this.speedProfileService = deps.speedProfileService;
    this.downloadQueueService = deps.downloadQueueService;
    this.torrentManagementService = deps.torrentManagementService;
    this.db = deps.db;
  }

  /**
   * Get the primary torrent client
   */
  private getTorrentClient(): ITorrentClient | undefined {
    const primary = this.torrentClientRegistry.getPrimary();
    return primary?.provider;
  }

  async execute(): Promise<void> {
    this.emitStarted("Starting torrent monitor job");
    this.logger.info("Starting torrent monitor job");

    const torrentClient = this.getTorrentClient();
    if (!torrentClient) {
      this.logger.warn("qBittorrent not configured, skipping torrent monitor job");
      this.emitCompleted("Skipped: qBittorrent not configured");
      return;
    }

    try {
      // Get all torrents from qBittorrent
      const torrents = await torrentClient.getTorrents();

      this.emitProgress(
        `Found ${torrents.length} torrents in qBittorrent`,
        0,
        torrents.length
      );

      this.logger.info(`Found ${torrents.length} torrents in qBittorrent`);

      // Get all download queue items with scene info for title matching
      // Include move_failed and add_failed statuses to handle torrents that need processing:
      // - move_failed: torrents that completed but failed to move
      // - add_failed: torrents that were added to qBittorrent but hash lookup timed out
      const downloadingItems = await this.db.query.downloadQueue.findMany({
        where: inArray(downloadQueue.status, ["downloading", "queued", "completed", "move_failed", "add_failed"]),
        with: {
          scene: {
            columns: {
              title: true,
            },
          },
        },
      });

      // Map torrent hashes to download queue items (primary matching)
      const hashToQueueItem = new Map(
        downloadingItems
          .filter((item) => item.qbitHash || item.torrentHash)
          .map((item) => {
            const hash = (item.qbitHash || item.torrentHash!).toLowerCase();
            return [hash, item];
          })
      );

      // Create a set of already matched items to avoid duplicate processing
      const matchedItemIds = new Set<string>();

      this.logger.info(
        {
          totalQueueItems: downloadingItems.length,
          hashedItemsCount: hashToQueueItem.size,
        },
        "Hash map created for torrent monitoring"
      );

      let processedCount = 0;

      // First pass: Match by hash (exact) - primary method
      for (const torrent of torrents) {
        let queueItem = hashToQueueItem.get(torrent.hash);

        if (queueItem) {
          matchedItemIds.add(queueItem.id);
          try {
            processedCount++;
            await this.processTorrent(torrent, queueItem, processedCount, torrents.length);
          } catch (error) {
            this.logger.error(
              { error, torrentHash: torrent.hash },
              "Failed to process torrent"
            );
            try {
              await this.db
                .update(downloadQueue)
                .set({ status: "move_failed" })
                .where(eq(downloadQueue.id, queueItem.id));
            } catch (updateError) {
              this.logger.error({ updateError }, "Failed to update status to move_failed");
            }
          }
        }
      }

      // Second pass: Match unmatched items by title (simple substring matching)
      // This handles cases where addTorrentAndGetHash failed but torrent was added
      for (const torrent of torrents) {
        // Skip if already matched by hash
        if (hashToQueueItem.has(torrent.hash)) continue;

        const torrentName = (torrent.name as string)?.toLowerCase() || '';

        let queueItem = downloadingItems.find(item => {
          // Skip if already matched
          if (matchedItemIds.has(item.id)) return false;

          const itemTitle = (item.scene?.title || item.title)?.toLowerCase() || '';
          // Simple substring matching - should work well since differential approach
          // in addTorrentAndGetHash should have handled most cases
          return torrentName.includes(itemTitle) || itemTitle.includes(torrentName);
        });

        if (queueItem && torrent.hash) {
          this.logger.info(
            {
              itemId: queueItem.id,
              torrentName: torrent.name,
              torrentHash: torrent.hash,
              itemTitle: queueItem.title,
              currentStatus: queueItem.status,
            },
            "Found torrent by title match (fallback), updating qbitHash and status"
          );

          try {
            // Update qbitHash and status
            const newStatus = queueItem.status === "add_failed" ? "downloading" : queueItem.status;
            await this.db
              .update(downloadQueue)
              .set({
                qbitHash: torrent.hash,
                status: newStatus,
                addToClientError: null, // Clear error message on successful match
              })
              .where(eq(downloadQueue.id, queueItem.id));

            matchedItemIds.add(queueItem.id);

            // Process the newly matched torrent
            processedCount++;
            await this.processTorrent(torrent, queueItem, processedCount, torrents.length);
          } catch (error) {
            this.logger.error(
              { error, itemId: queueItem.id },
              "Failed to update/process matched torrent"
            );
          }
        }
      }

      // Apply speed profiles
      await this.applySpeedProfiles();

      // Run auto-management
      await this.runAutoManagement();

      // Remove old completed torrents
      await this.removeOldCompletedTorrents();

      // Retry failed torrents (add_failed status)
      // This is for torrents that failed to add to qBittorrent, NOT indexer searches
      await this.retryFailedTorrents();

      this.emitCompleted(
        `Completed: Processed ${processedCount} torrents`,
        { processedCount, totalTorrents: torrents.length }
      );

      this.logger.info("Torrent monitor job completed");
    } catch (error) {
      this.emitFailed(
        `Torrent monitor job failed: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error({ error }, "Torrent monitor job failed");
      throw error;
    }
  }

  private async processTorrent(
    torrent: any,
    queueItem: any,
    current: number,
    total: number
  ): Promise<void> {
    // Check if torrent is stalled
    const isStalled = this.checkIfStalled(torrent);

    if (isStalled) {
      this.logger.warn(
        {
          torrentHash: torrent.hash,
          name: torrent.name,
          seeders: torrent.num_seeds,
          downloadSpeed: torrent.dlspeed,
        },
        "Torrent is stalled, pausing and moving to bottom of queue"
      );

      // Move to bottom of queue
      const torrentClient = this.getTorrentClient();
      if (torrentClient) {
        await torrentClient.setTorrentPriority(torrent.hash, "bottom");
        // Pause stalled torrent
        await torrentClient.pauseTorrent(torrent.hash);
      }

      // Update status in database
      await this.db
        .update(downloadQueue)
        .set({ status: "paused" })
        .where(eq(downloadQueue.id, queueItem.id));
    } else if (torrent.state === "pausedDL") {
      // Torrent is paused in qBittorrent but not in our DB
      if (queueItem.status === "downloading") {
        await this.db
          .update(downloadQueue)
          .set({ status: "paused" })
          .where(eq(downloadQueue.id, queueItem.id));
      }
    } else if (torrent.progress >= 1.0 && queueItem.status !== "completed") {
      // Torrent completed
      let statusMessage = "Torrent completed, processing...";
      if (queueItem.status === "add_failed") {
        statusMessage = "Torrent was in qBittorrent but hash was not linked - now processing!";
      } else if (queueItem.status === "move_failed") {
        statusMessage = "Retrying previously failed torrent completion...";
      }

      this.logger.info(
        { torrentHash: torrent.hash, name: torrent.name, currentStatus: queueItem.status },
        statusMessage
      );

      this.emitProgress(
        `Processing completed torrent: ${torrent.name}`,
        current,
        total,
        { torrentName: torrent.name }
      );

      // Store qbitHash if not already stored
      if (!queueItem.qbitHash) {
        this.logger.info({ torrentHash: torrent.hash }, "Storing qBittorrent hash");
        await this.db
          .update(downloadQueue)
          .set({ qbitHash: torrent.hash })
          .where(eq(downloadQueue.id, queueItem.id));
      }

      // Handle torrent completion
      this.logger.info(
        { torrentHash: torrent.hash, sceneId: queueItem.sceneId },
        "Calling handleTorrentCompleted"
      );

      await this.torrentCompletionService.handleTorrentCompleted(torrent.hash);

      this.logger.info(
        { torrentHash: torrent.hash, sceneId: queueItem.sceneId },
        "handleTorrentCompleted finished successfully"
      );
    } else if ((queueItem.status === "queued" || queueItem.status === "add_failed") && torrent.state !== "pausedDL") {
      // Torrent is actively downloading, update status
      // For add_failed: the torrent was actually added to qBittorrent but we didn't get the hash
      // Now that we've matched it by title, update the status to reflect it's downloading
      await this.db
        .update(downloadQueue)
        .set({ status: "downloading" })
        .where(eq(downloadQueue.id, queueItem.id));
    }
  }

  private checkIfStalled(torrent: any): boolean {
    // Consider stalled if:

    // 1. Torrent is in stalledDL state (qBittorrent reports no activity)
    // This state means the download is stalled - should pause immediately
    if (torrent.state === "stalledDL") {
      this.logger.debug(
        { hash: torrent.hash, name: torrent.name, state: torrent.state },
        "Torrent is in stalledDL state, will pause"
      );
      return true;
    }

    // 2. No seeders available
    if (torrent.num_seeds === 0) {
      return true;
    }

    // 3. Download speed is 0 for active torrents
    if (torrent.state === "downloading" && torrent.dlspeed === 0 && torrent.progress < 1.0) {
      return true;
    }

    // 4. Very low seeders (< 2) and very low speed (< 10 KB/s)
    if (torrent.num_seeds < 2 && torrent.dlspeed < 10240) {
      return true;
    }

    // Note: metaDL (downloading metadata), checkingDL (checking data),
    // and allocating (allocating disk space) states are handled by
    // torrentManagementService.checkMetadataStuck() with proper timeout checks

    return false;
  }

  private async applySpeedProfiles(): Promise<void> {
    const settings = this.speedProfileService.getSettings();

    if (!settings.enabled) {
      return;
    }

    const limits = this.speedProfileService.getActiveSpeedLimits();

    this.logger.info(
      { limits: this.speedProfileService.formatSpeedLimits(limits) },
      "Applying speed profile"
    );

    try {
      const torrentClient = this.getTorrentClient();
      if (torrentClient) {
        await torrentClient.setGlobalSpeedLimits(
          limits.downloadLimit,
          limits.uploadLimit
        );
      }
    } catch (error) {
      this.logger.error({ error }, "Failed to apply speed profile");
    }
  }

  private async removeOldCompletedTorrents(): Promise<void> {
    const torrentClient = this.getTorrentClient();
    if (!torrentClient) {
      return;
    }

    const settings = await this.settingsService.getSettings();
    const daysToKeep = settings.fileManagement.removeFromQbitAfterDays || 7;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    this.logger.info(
      `Checking for completed torrents older than ${cutoffDate.toISOString()}`
    );

    const oldItems = await this.db.query.downloadQueue.findMany({
      where: and(
        eq(downloadQueue.status, "completed"),
        lt(downloadQueue.completedAt, cutoffDate.toISOString())
      ),
    });

    if (oldItems.length === 0) {
      this.logger.debug("No old completed torrents to remove");
      return;
    }

    this.logger.info(`Found ${oldItems.length} old completed torrents to remove`);

    let removedFromQbit = 0;
    let removedFromQueue = 0;

    for (const item of oldItems) {
      try {
        if (item.qbitHash) {
          await torrentClient.deleteTorrent(item.qbitHash, false);
          removedFromQbit++;
          this.logger.debug(
            `Removed torrent ${item.qbitHash} from qBittorrent (kept files)`
          );
        }

        await this.db
          .update(downloadQueue)
          .set({ qbitHash: null })
          .where(eq(downloadQueue.id, item.id));
        removedFromQueue++;
      } catch (error) {
        this.logger.error(
          { error, itemId: item.id },
          `Failed to remove old torrent from queue`
        );
      }
    }

    this.logger.info(
      `Removed ${removedFromQbit} torrents from qBittorrent and marked ${removedFromQueue} queue items as cleaned`
    );
  }

  private async retryFailedTorrents(): Promise<void> {
    try {
      const result = await this.downloadQueueService.retryFailedTorrents(5);

      this.logger.info(
        {
          total: result.total,
          succeeded: result.succeeded,
          permanentFailures: result.permanentFailures,
        },
        "Failed torrent retry completed"
      );

      if (result.succeeded > 0) {
        this.logger.info(`Successfully retried ${result.succeeded} torrents`);
      }

      if (result.permanentFailures > 0) {
        this.logger.warn(
          `${result.permanentFailures} torrents permanently failed (max attempts reached)`
        );
      }
    } catch (error) {
      this.logger.error({ error }, "Failed to retry torrents");
    }
  }

  /**
   * Run automatic torrent management
   */
  private async runAutoManagement(): Promise<void> {
    try {
      // Update settings from current app settings
      const settings = await this.settingsService.getSettings();
      this.torrentManagementService.updateSettings(settings.torrentAutoManagement);

      const pauseResult = await this.torrentManagementService.checkAndPauseTorrents();

      this.logger.info(
        {
          checked: pauseResult.checked,
          paused: pauseResult.paused,
        },
        "Auto-management check completed"
      );

      // Also update last activity for active torrents
      await this.updateActivityTracking();

      // Try retrying paused torrents
      const retryResult = await this.torrentManagementService.retryPausedTorrents();

      this.logger.info(
        {
          total: retryResult.total,
          retried: retryResult.retried,
          skipped: retryResult.skipped,
        },
        "Auto-management retry completed"
      );
    } catch (error) {
      this.logger.error({ error }, "Auto-management failed");
    }
  }

  /**
   * Update last activity timestamp for active torrents
   */
  private async updateActivityTracking(): Promise<void> {
    const torrentClient = this.getTorrentClient();
    if (!torrentClient) return;

    const torrents = await torrentClient.getTorrents();
    const activeTorrents = torrents.filter(
      (t) => t.dlspeed > 0 && t.state !== "pausedDL"
    );

    for (const torrent of activeTorrents) {
      await this.downloadQueueRepository.updateLastActivity(torrent.hash);
    }
  }
}
