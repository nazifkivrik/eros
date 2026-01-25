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
import type { ITorrentClient } from "@/infrastructure/adapters/interfaces/torrent-client.interface.js";
import type { SettingsService } from "../../application/services/settings.service.js";
import type { SpeedProfileService } from "../../application/services/speed-profile.service.js";
import type { DownloadQueueService } from "../../application/services/download-queue.service.js";
import type { Database } from "@repo/database";
import { eq, inArray, lt, and } from "drizzle-orm";
import { downloadQueue } from "@repo/database";

export class TorrentMonitorJob extends BaseJob {
  readonly name = "torrent-monitor";
  readonly description = "Monitor torrent downloads and handle completions";

  private downloadQueueRepository: DownloadQueueRepository;
  private torrentCompletionService: TorrentCompletionHandlerService;
  private torrentClient: ITorrentClient | undefined;
  private settingsService: SettingsService;
  private speedProfileService: SpeedProfileService;
  private downloadQueueService: DownloadQueueService;
  private db: Database;

  constructor(deps: {
    logger: Logger;
    jobProgressService: JobProgressService;
    downloadQueueRepository: DownloadQueueRepository;
    torrentCompletionService: TorrentCompletionHandlerService;
    torrentClient: ITorrentClient | undefined;
    settingsService: SettingsService;
    speedProfileService: SpeedProfileService;
    downloadQueueService: DownloadQueueService;
    db: Database;
  }) {
    super(deps);
    this.downloadQueueRepository = deps.downloadQueueRepository;
    this.torrentCompletionService = deps.torrentCompletionService;
    this.torrentClient = deps.torrentClient;
    this.settingsService = deps.settingsService;
    this.speedProfileService = deps.speedProfileService;
    this.downloadQueueService = deps.downloadQueueService;
    this.db = deps.db;
  }

  async execute(): Promise<void> {
    this.emitStarted("Starting torrent monitor job");
    this.logger.info("Starting torrent monitor job");

    if (!this.torrentClient) {
      this.logger.warn("qBittorrent not configured, skipping torrent monitor job");
      this.emitCompleted("Skipped: qBittorrent not configured");
      return;
    }

    try {
      // Get all torrents from qBittorrent
      const torrents = await this.torrentClient.getTorrents();

      this.emitProgress(
        `Found ${torrents.length} torrents in qBittorrent`,
        0,
        torrents.length
      );

      this.logger.info(`Found ${torrents.length} torrents in qBittorrent`);

      // Get all download queue items
      const downloadingItems = await this.db.query.downloadQueue.findMany({
        where: inArray(downloadQueue.status, ["downloading", "queued", "completed"]),
      });

      // Map torrent hashes to download queue items
      const hashToQueueItem = new Map(
        downloadingItems
          .filter((item) => item.qbitHash || item.torrentHash)
          .map((item) => {
            const hash = (item.qbitHash || item.torrentHash!).toLowerCase();
            return [hash, item];
          })
      );

      this.logger.info(
        {
          totalQueueItems: downloadingItems.length,
          hashedItemsCount: hashToQueueItem.size,
        },
        "Hash map created for torrent monitoring"
      );

      let processedCount = 0;
      for (const torrent of torrents) {
        const queueItem = hashToQueueItem.get(torrent.hash);

        if (!queueItem) {
          this.logger.debug(
            { torrentHash: torrent.hash, torrentName: torrent.name },
            "Torrent not found in queue map"
          );
          continue;
        }

        try {
          processedCount++;
          await this.processTorrent(torrent, queueItem, processedCount, torrents.length);
        } catch (error) {
          this.logger.error(
            { error, torrentHash: torrent.hash },
            "Failed to monitor torrent"
          );
        }
      }

      // Apply speed profiles
      await this.applySpeedProfiles();

      // Remove old completed torrents
      await this.removeOldCompletedTorrents();

      // Retry failed torrents
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
      await this.torrentClient!.setTorrentPriority(torrent.hash, "bottom");

      // Pause stalled torrent
      await this.torrentClient!.pauseTorrent(torrent.hash);

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
      this.logger.info(
        { torrentHash: torrent.hash, name: torrent.name, currentStatus: queueItem.status },
        "Torrent completed, processing..."
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
    } else if (queueItem.status === "queued" && torrent.state !== "pausedDL") {
      // Torrent is actively downloading, update status
      await this.db
        .update(downloadQueue)
        .set({ status: "downloading" })
        .where(eq(downloadQueue.id, queueItem.id));
    }
  }

  private checkIfStalled(torrent: any): boolean {
    // Consider stalled if:
    // 1. No seeders available
    if (torrent.num_seeds === 0) {
      return true;
    }

    // 2. Download speed is 0 for active torrents
    if (torrent.state === "downloading" && torrent.dlspeed === 0 && torrent.progress < 1.0) {
      return true;
    }

    // 3. Very low seeders (< 2) and very low speed (< 10 KB/s)
    if (torrent.num_seeds < 2 && torrent.dlspeed < 10240) {
      return true;
    }

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
      if (this.torrentClient) {
        await this.torrentClient.setGlobalSpeedLimits(
          limits.downloadLimit,
          limits.uploadLimit
        );
      }
    } catch (error) {
      this.logger.error({ error }, "Failed to apply speed profile");
    }
  }

  private async removeOldCompletedTorrents(): Promise<void> {
    if (!this.torrentClient) {
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
          await this.torrentClient.deleteTorrent(item.qbitHash, false);
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
}
