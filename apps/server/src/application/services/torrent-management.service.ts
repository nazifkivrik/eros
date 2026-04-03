/**
 * Torrent Management Service
 * Handles automatic pause/retry logic for torrents
 * Follows Clean Architecture principles
 */

import type { Logger } from "pino";
import type {
  TorrentInfo,
  ITorrentClient,
} from "@/infrastructure/adapters/interfaces/torrent-client.interface.js";
import type { TorrentClientRegistry } from "@/infrastructure/registries/provider-registry.js";
import type { DownloadQueueRepository } from "@/infrastructure/repositories/download-queue.repository.js";
import {
  DEFAULT_TORRENT_AUTO_MANAGEMENT,
  type TorrentAutoManagementSettings,
  type AutoPauseReason,
} from "@repo/shared-types";

// Queue item type extracted from repository method return type
type QueueItem = NonNullable<
  Awaited<ReturnType<DownloadQueueRepository["findByQbitHash"]>>
>;

export class TorrentManagementService {
  private downloadQueueRepository: DownloadQueueRepository;
  private torrentClientRegistry: TorrentClientRegistry;
  private logger: Logger;
  private settings: TorrentAutoManagementSettings;

  constructor(deps: {
    downloadQueueRepository: DownloadQueueRepository;
    torrentClientRegistry: TorrentClientRegistry;
    logger: Logger;
  }) {
    this.downloadQueueRepository = deps.downloadQueueRepository;
    this.torrentClientRegistry = deps.torrentClientRegistry;
    this.logger = deps.logger;
    this.settings = DEFAULT_TORRENT_AUTO_MANAGEMENT;
  }

  updateSettings(settings: TorrentAutoManagementSettings): void {
    this.settings = settings;
    this.logger.info({ settings }, "Torrent management settings updated");
  }

  getSettings(): TorrentAutoManagementSettings {
    return this.settings;
  }

  private getTorrentClient(): ITorrentClient | undefined {
    const primary = this.torrentClientRegistry.getPrimary();
    return primary?.provider;
  }

  /**
   * Main entry point: Check all torrents and pause those meeting criteria
   */
  async checkAndPauseTorrents(): Promise<{
    checked: number;
    paused: number;
  }> {
    if (!this.settings.enabled) {
      return { checked: 0, paused: 0 };
    }

    const torrentClient = this.getTorrentClient();
    if (!torrentClient) {
      this.logger.warn("Torrent client not available for auto-management");
      return { checked: 0, paused: 0 };
    }

    const torrents = await torrentClient.getTorrents();
    const results = { checked: 0, paused: 0 };

    // Pre-load all queue items in a single query to avoid N+1
    const hashes = torrents.map((t) => t.hash.toLowerCase());
    const queueItems = (await this.downloadQueueRepository.findByHashes(
      hashes
    )) as QueueItem[];
    const queueMap: Map<string, QueueItem> = new Map(
      queueItems.map((item): [string, QueueItem] => [
        (item.qbitHash ?? "").toLowerCase(),
        item,
      ])
    );

    for (const torrent of torrents) {
      results.checked++;

      const shouldPause = await this.shouldPauseTorrent(torrent, queueMap);

      if (shouldPause.pause) {
        await this.pauseTorrent(torrent, shouldPause.reason!, queueMap);
        results.paused++;
      }
    }

    return results;
  }

  /**
   * Evaluate if a torrent should be paused
   */
  private async shouldPauseTorrent(
    torrent: TorrentInfo,
    queueMap: Map<string, QueueItem>
  ): Promise<{
    pause: boolean;
    reason?: AutoPauseReason;
  }> {
    // Skip completed torrents
    if (torrent.progress >= 1.0) {
      return { pause: false };
    }

    // If already paused in qBittorrent, ensure DB tracking is consistent
    if (torrent.state === "pausedDL") {
      await this.ensurePauseTracking(torrent, queueMap);
      return { pause: false };
    }

    // Check for metadata stuck
    if (this.settings.pauseOnMetadataStuck) {
      const shouldPause = await this.checkMetadataStuck(torrent, queueMap);
      if (shouldPause) return { pause: true, reason: "metadata" };
    }

    // Check for stalled (includes stalledDL state check)
    if (this.settings.pauseOnStalled) {
      const shouldPause = this.checkStalled(torrent);
      if (shouldPause) return { pause: true, reason: "stalled" };
    }

    // Check for slow speed
    if (this.settings.pauseOnSlowSpeed) {
      const shouldPause = await this.checkSlowSpeed(torrent, queueMap);
      if (shouldPause) return { pause: true, reason: "slow" };
    }

    // Check for no activity
    if (this.settings.pauseOnNoActivity) {
      const shouldPause = await this.checkNoActivity(torrent, queueMap);
      if (shouldPause) return { pause: true, reason: "no_activity" };
    }

    return { pause: false };
  }

  /**
   * Ensure DB tracking is consistent for already-paused torrents
   * Fixes orphaned pauses where autoManagementPaused was never set
   */
  private async ensurePauseTracking(
    torrent: TorrentInfo,
    queueMap: Map<string, QueueItem>
  ): Promise<void> {
    const queueItem = queueMap.get(torrent.hash.toLowerCase());

    if (queueItem && !queueItem.autoManagementPaused) {
      // Torrent is paused in qBittorrent but not tracked — fix it
      await this.downloadQueueRepository.updateAutoManagementTracking(
        queueItem.id,
        {
          autoManagementPaused: true,
          autoPauseReason: queueItem.autoPauseReason || "stalled",
          autoPauseCount: (queueItem.autoPauseCount || 0) + 1,
          lastAutoPauseAt: new Date().toISOString(),
        }
      );

      this.logger.info(
        {
          hash: torrent.hash,
          name: torrent.name,
          queueItemId: queueItem.id,
        },
        "Fixed orphaned pause tracking for torrent"
      );
    }
  }

  private checkStalled(torrent: TorrentInfo): boolean {
    const { maxSeeders, minSpeed } = this.settings.stallThreshold;

    // qBittorrent reports stalledDL when no data is being received
    if (torrent.state === "stalledDL") {
      return true;
    }

    // No seeders available
    if (torrent.numSeeds <= maxSeeders) {
      return true;
    }

    // Low seeders AND low speed (uses mapped field name from adapter)
    if (torrent.numSeeds < 2 && torrent.downloadSpeed < minSpeed) {
      return true;
    }

    return false;
  }

  private async checkMetadataStuck(
    torrent: TorrentInfo,
    queueMap: Map<string, QueueItem>
  ): Promise<boolean> {
    if (torrent.state !== "metaDL") {
      return false;
    }

    // Get queue item to check how long it's been in metadata state
    const queueItem = queueMap.get(torrent.hash.toLowerCase());

    if (queueItem?.lastAutoPauseAt) {
      const pauseTime = new Date(queueItem.lastAutoPauseAt).getTime();
      const now = Date.now();
      const minutesInState = (now - pauseTime) / (1000 * 60);
      return minutesInState > this.settings.metadataTimeoutMinutes;
    }

    // Use torrent.addedOn as fallback
    const addedOnSeconds = torrent.addedOn || 0;
    const addedOnMs = addedOnSeconds * 1000;
    const minutesInState = (Date.now() - addedOnMs) / (1000 * 60);

    return minutesInState > this.settings.metadataTimeoutMinutes;
  }

  private async checkSlowSpeed(
    torrent: TorrentInfo,
    queueMap: Map<string, QueueItem>
  ): Promise<boolean> {
    if (torrent.downloadSpeed >= this.settings.slowSpeedThreshold) {
      return false;
    }

    // Need to track how long it's been slow - check database
    const queueItem = queueMap.get(torrent.hash.toLowerCase());

    if (queueItem?.lastActivityAt) {
      const lastActivity = new Date(queueItem.lastActivityAt).getTime();
      const minutesSlow = (Date.now() - lastActivity) / (1000 * 60);
      return minutesSlow >= this.settings.slowSpeedDurationMinutes;
    }

    return false;
  }

  private async checkNoActivity(
    torrent: TorrentInfo,
    queueMap: Map<string, QueueItem>
  ): Promise<boolean> {
    const queueItem = queueMap.get(torrent.hash.toLowerCase());

    if (!queueItem?.lastActivityAt) {
      return false;
    }

    const lastActivity = new Date(queueItem.lastActivityAt).getTime();
    const minutesInactive = (Date.now() - lastActivity) / (1000 * 60);

    return minutesInactive >= this.settings.noActivityMinutes;
  }

  private async pauseTorrent(
    torrent: TorrentInfo,
    reason: AutoPauseReason,
    queueMap: Map<string, QueueItem>
  ): Promise<void> {
    const torrentClient = this.getTorrentClient();
    if (!torrentClient) return;

    try {
      // Pause in qBittorrent
      await torrentClient.pauseTorrent(torrent.hash);

      // Move to bottom of queue
      await torrentClient.setTorrentPriority(torrent.hash, "bottom");

      // Update database using pre-loaded queue item
      const queueItem = queueMap.get(torrent.hash.toLowerCase());
      if (queueItem) {
        await this.downloadQueueRepository.updateAutoManagementTracking(
          queueItem.id,
          {
            autoManagementPaused: true,
            autoPauseReason: reason,
            autoPauseCount: (queueItem.autoPauseCount || 0) + 1,
            lastAutoPauseAt: new Date().toISOString(),
          }
        );
      }

      this.logger.info(
        {
          hash: torrent.hash,
          name: torrent.name,
          reason,
        },
        "Auto-paused torrent"
      );
    } catch (error) {
      this.logger.error(
        { error, hash: torrent.hash },
        "Failed to auto-pause torrent"
      );
    }
  }

  /**
   * Retry paused torrents when queue is empty or based on settings
   */
  async retryPausedTorrents(): Promise<{
    total: number;
    retried: number;
    skipped: number;
  }> {
    if (!this.settings.enabled) {
      return { total: 0, retried: 0, skipped: 0 };
    }

    // Check if we should retry based on retry behavior
    if (this.settings.retryBehavior === "queue_empty") {
      const activeDownloads = await this.getActiveDownloadCount();
      if (activeDownloads > 0) {
        this.logger.debug("Queue not empty, skipping retry");
        return { total: 0, retried: 0, skipped: 0 };
      }
    }

    const torrentClient = this.getTorrentClient();
    if (!torrentClient) {
      return { total: 0, retried: 0, skipped: 0 };
    }

    // Get torrents to retry (auto-paused, under max retries)
    const candidates =
      await this.downloadQueueRepository.findAutoPausedForRetry(
        this.settings.maxRetries
      );

    let retried = 0;
    let skipped = 0;

    // Sort by combined priority if enabled
    const toRetry = this.settings.useCombinedPriority
      ? this.sortByCombinedPriority(candidates)
      : candidates;

    for (const item of toRetry) {
      // FIX: If no qbitHash but status is add_failed, skip (can't retry without hash)
      // These torrents need manual intervention or need to be re-added with proper magnet link
      if (!item.qbitHash) {
        this.logger.debug(
          { id: item.id, status: item.status },
          "Skipping torrent retry - no qbitHash available"
        );
        skipped++;
        continue;
      }

      const shouldRetry = (item.autoPauseCount || 0) < this.settings.maxRetries;

      if (!shouldRetry) {
        skipped++;
        continue;
      }

      try {
        await torrentClient.resumeTorrent(item.qbitHash);

        // Update database: clear pause tracking, reset activity
        await this.downloadQueueRepository.updateAutoManagementTracking(
          item.id,
          {
            autoManagementPaused: false,
            autoPauseReason: null,
            lastAutoPauseAt: new Date().toISOString(),
          }
        );

        // Also reset lastActivityAt so slow-speed timer starts fresh
        await this.downloadQueueRepository.updateLastActivity(item.qbitHash);

        this.logger.info(
          {
            id: item.id,
            hash: item.qbitHash,
            attempt: (item.autoPauseCount || 0) + 1,
          },
          "Retried auto-paused torrent"
        );
        retried++;
      } catch (error) {
        this.logger.error({ error, id: item.id }, "Failed to retry torrent");
      }
    }

    return { total: candidates.length, retried, skipped };
  }

  private async getActiveDownloadCount(): Promise<number> {
    const items = await this.downloadQueueRepository.findAll();
    return items.filter(
      (i: QueueItem) => i.status === "downloading" && !i.autoManagementPaused
    ).length;
  }

  private sortByCombinedPriority(items: QueueItem[]): QueueItem[] {
    return [...items].sort((a, b) => {
      // Priority = fewer retries = higher priority (lower number)
      // We use retry count as a penalty
      const aPriority =
        (a.autoPauseCount || 0) * this.settings.retryCountWeight;
      const bPriority =
        (b.autoPauseCount || 0) * this.settings.retryCountWeight;

      return aPriority - bPriority;
    });
  }
}
