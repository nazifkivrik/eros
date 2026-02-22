/**
 * Torrent Management Service
 * Handles automatic pause/retry logic for torrents
 * Follows Clean Architecture principles
 */

import type { Logger } from "pino";
import type { ITorrentClient } from "@/infrastructure/adapters/interfaces/torrent-client.interface.js";
import type { TorrentClientRegistry } from "@/infrastructure/registries/provider-registry.js";
import type { DownloadQueueRepository } from "@/infrastructure/repositories/download-queue.repository.js";
import type {
  TorrentAutoManagementSettings,
  AutoPauseReason,
} from "@repo/shared-types";
import { DEFAULT_TORRENT_AUTO_MANAGEMENT } from "@repo/shared-types";

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

    for (const torrent of torrents) {
      results.checked++;

      const shouldPause = await this.shouldPauseTorrent(torrent);

      if (shouldPause.pause) {
        await this.pauseTorrent(torrent, shouldPause.reason!);
        results.paused++;
      }
    }

    return results;
  }

  /**
   * Evaluate if a torrent should be paused
   */
  private async shouldPauseTorrent(torrent: any): Promise<{
    pause: boolean;
    reason?: AutoPauseReason;
  }> {
    // Skip if already completed or manually paused
    if (torrent.progress >= 1.0 || torrent.state === "pausedDL") {
      return { pause: false };
    }

    // Check for metadata stuck
    if (this.settings.pauseOnMetadataStuck) {
      const shouldPause = await this.checkMetadataStuck(torrent);
      if (shouldPause) return { pause: true, reason: "metadata" };
    }

    // Check for stalled
    if (this.settings.pauseOnStalled) {
      const shouldPause = this.checkStalled(torrent);
      if (shouldPause) return { pause: true, reason: "stalled" };
    }

    // Check for slow speed
    if (this.settings.pauseOnSlowSpeed) {
      const shouldPause = await this.checkSlowSpeed(torrent);
      if (shouldPause) return { pause: true, reason: "slow" };
    }

    // Check for no activity
    if (this.settings.pauseOnNoActivity) {
      const shouldPause = await this.checkNoActivity(torrent);
      if (shouldPause) return { pause: true, reason: "no_activity" };
    }

    return { pause: false };
  }

  private checkStalled(torrent: any): boolean {
    const { maxSeeders, minSpeed } = this.settings.stallThreshold;

    // No seeders
    if (torrent.num_seeds <= maxSeeders) {
      return true;
    }

    // Low seeders AND low speed
    if (torrent.num_seeds < 2 && torrent.dlspeed < minSpeed) {
      return true;
    }

    return false;
  }

  private async checkMetadataStuck(torrent: any): Promise<boolean> {
    if (torrent.state !== "metaDL") {
      return false;
    }

    // Get queue item to check how long it's been in metadata state
    const queueItem = await this.downloadQueueRepository.findByQbitHash(torrent.hash);

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

  private async checkSlowSpeed(torrent: any): Promise<boolean> {
    if (torrent.dlspeed >= this.settings.slowSpeedThreshold) {
      return false;
    }

    // Need to track how long it's been slow - check database
    const queueItem = await this.downloadQueueRepository.findByQbitHash(torrent.hash);

    if (queueItem?.lastActivityAt) {
      const lastActivity = new Date(queueItem.lastActivityAt).getTime();
      const minutesSlow = (Date.now() - lastActivity) / (1000 * 60);
      return minutesSlow >= this.settings.slowSpeedDurationMinutes;
    }

    return false;
  }

  private async checkNoActivity(torrent: any): Promise<boolean> {
    const queueItem = await this.downloadQueueRepository.findByQbitHash(torrent.hash);

    if (!queueItem?.lastActivityAt) {
      return false;
    }

    const lastActivity = new Date(queueItem.lastActivityAt).getTime();
    const minutesInactive = (Date.now() - lastActivity) / (1000 * 60);

    return minutesInactive >= this.settings.noActivityMinutes;
  }

  private async pauseTorrent(
    torrent: any,
    reason: AutoPauseReason
  ): Promise<void> {
    const torrentClient = this.getTorrentClient();
    if (!torrentClient) return;

    try {
      // Pause in qBittorrent
      await torrentClient.pauseTorrent(torrent.hash);

      // Move to bottom of queue
      await torrentClient.setTorrentPriority(torrent.hash, "bottom");

      // Update database
      const queueItem = await this.downloadQueueRepository.findByQbitHash(torrent.hash);
      if (queueItem) {
        await this.downloadQueueRepository.updateAutoManagementTracking(queueItem.id, {
          autoManagementPaused: true,
          autoPauseReason: reason,
          autoPauseCount: (queueItem.autoPauseCount || 0) + 1,
          lastAutoPauseAt: new Date().toISOString(),
        });
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
      this.logger.error({ error, hash: torrent.hash }, "Failed to auto-pause torrent");
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
    const candidates = await this.downloadQueueRepository.findAutoPausedForRetry(
      this.settings.maxRetries
    );

    let retried = 0;
    let skipped = 0;

    // Sort by combined priority if enabled
    const toRetry = this.settings.useCombinedPriority
      ? this.sortByCombinedPriority(candidates)
      : candidates;

    for (const item of toRetry) {
      if (!item.qbitHash) continue;

      const shouldRetry = (item.autoPauseCount || 0) < this.settings.maxRetries;

      if (!shouldRetry) {
        skipped++;
        continue;
      }

      try {
        await torrentClient.resumeTorrent(item.qbitHash);

        // Update database
        await this.downloadQueueRepository.updateAutoManagementTracking(item.id, {
          autoManagementPaused: false,
          autoPauseReason: null,
          lastAutoPauseAt: new Date().toISOString(),
        });

        this.logger.info({ id: item.id, hash: item.qbitHash }, "Retried auto-paused torrent");
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
      (i) => i.status === "downloading" && !i.autoManagementPaused
    ).length;
  }

  private sortByCombinedPriority(items: any[]): any[] {
    return [...items].sort((a, b) => {
      // Priority = fewer retries = higher priority (lower number)
      // We use retry count as a penalty
      const aPriority = (a.autoPauseCount || 0) * this.settings.retryCountWeight;
      const bPriority = (b.autoPauseCount || 0) * this.settings.retryCountWeight;

      return aPriority - bPriority;
    });
  }
}
