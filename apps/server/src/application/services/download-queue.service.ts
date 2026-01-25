import type { Logger } from "pino";
import { nanoid } from "nanoid";
import type { DownloadStatus } from "@repo/shared-types";
import { DownloadQueueRepository } from "@/infrastructure/repositories/download-queue.repository.js";
import type { ITorrentClient } from "@/infrastructure/adapters/interfaces/torrent-client.interface.js";

/**
 * DTOs for Download Queue Service
 */
export interface CreateDownloadQueueDTO {
  sceneId: string;
  title: string;
  size: number;
  seeders: number;
  quality: string;
  magnetLink?: string;
}

export interface UpdateDownloadQueueDTO {
  status?: DownloadStatus;
  torrentHash?: string | null;
  completedAt?: string | null;
  qbitHash?: string | null;
}

export interface UnifiedDownload {
  id: string;
  sceneId: string;
  sceneTitle: string;
  scenePoster: string | null;
  sceneStudio: string | null;
  qbitHash: string | null;
  status: DownloadStatus;
  progress: number | null;
  downloadSpeed: number | null;
  uploadSpeed: number | null;
  eta: number | null;
  ratio: number | null;
  size: number;
  seeders: number;
  leechers: number;
  quality: string;
  priority: number | null;
  addedAt: string;
  completedAt: string | null;
  // Retry tracking for failed torrents
  addToClientAttempts: number | null;
  addToClientLastAttempt: string | null;
  addToClientError: string | null;
}

/**
 * Download Queue Service (Clean Architecture)
 * Business logic for download queue management
 * Handles: Queue CRUD, torrent client integration, unified downloads
 */
export class DownloadQueueService {
  private downloadQueueRepository: DownloadQueueRepository;
  private torrentClient?: ITorrentClient;
  private logger: Logger;

  constructor({
    downloadQueueRepository,
    torrentClient,
    logger,
  }: {
    downloadQueueRepository: DownloadQueueRepository;
    torrentClient?: ITorrentClient;
    logger: Logger;
  }) {
    this.downloadQueueRepository = downloadQueueRepository;
    this.torrentClient = torrentClient;
    this.logger = logger;
  }

  /**
   * Get all download queue items
   * Business logic: Filter by status if provided
   */
  async getAllQueueItems(statusFilter?: DownloadStatus) {
    this.logger.debug({ statusFilter }, "Fetching download queue items");

    const items = await this.downloadQueueRepository.findAll(statusFilter);

    this.logger.info({ count: items.length, statusFilter }, "Fetched queue items");

    return items;
  }

  /**
   * Get download queue item by ID
   * Business rule: Returns null if not found
   */
  async getQueueItemById(id: string) {
    this.logger.debug({ id }, "Fetching queue item by ID");

    const item = await this.downloadQueueRepository.findById(id);

    if (!item) {
      this.logger.warn({ id }, "Queue item not found");
      return null;
    }

    return item;
  }

  /**
   * Add to download queue
   * Business logic:
   * - Validate scene exists
   * - Check for duplicates in queue
   * - Optionally start download in torrent client
   */
  async addToQueue(dto: CreateDownloadQueueDTO) {
    this.logger.info({ sceneId: dto.sceneId, title: dto.title }, "Adding to queue");

    // Business rule: Scene must exist
    const sceneExists = await this.downloadQueueRepository.sceneExists(dto.sceneId);
    if (!sceneExists) {
      throw new Error("Scene not found");
    }

    // Business rule: Cannot add same scene if already queued
    const existing = await this.downloadQueueRepository.findBySceneIdAndStatus(
      dto.sceneId,
      "queued"
    );

    if (existing) {
      throw new Error("Scene already in download queue");
    }

    const id = nanoid();
    const now = new Date().toISOString();

    const newItem = {
      id,
      sceneId: dto.sceneId,
      torrentHash: null,
      qbitHash: null,
      title: dto.title,
      size: dto.size,
      seeders: dto.seeders,
      quality: dto.quality,
      status: "queued" as const,
      addedAt: now,
      completedAt: null,
    };

    await this.downloadQueueRepository.create(newItem);

    // Business logic: If magnetLink provided and torrent client available, add torrent
    if (dto.magnetLink && this.torrentClient) {
      try {
        await this.torrentClient.addTorrent({
          magnetLinks: [dto.magnetLink],
          category: "eros",
          paused: false,
        });

        this.logger.info({ sceneId: dto.sceneId, title: dto.title }, "Added torrent to client");
      } catch (error) {
        this.logger.error(
          { error, sceneId: dto.sceneId, title: dto.title },
          "Failed to add torrent to client"
        );
      }
    }

    // Fetch the created item with scene info
    const created = await this.downloadQueueRepository.findById(id);
    return created;
  }

  /**
   * Update download queue item
   * Business rule: Item must exist
   */
  async updateQueueItem(id: string, dto: UpdateDownloadQueueDTO) {
    this.logger.info({ id, updates: dto }, "Updating queue item");

    const existing = await this.downloadQueueRepository.findById(id);
    if (!existing) {
      throw new Error("Download queue item not found");
    }

    const updated = await this.downloadQueueRepository.update(id, dto);
    this.logger.info({ id }, "Queue item updated");

    return updated;
  }

  /**
   * Remove from download queue
   * Business logic: Optionally delete torrent from client
   */
  async removeFromQueue(id: string, deleteTorrent: boolean = false) {
    this.logger.info({ id, deleteTorrent }, "Removing from queue");

    const item = await this.downloadQueueRepository.findById(id);
    if (!item) {
      throw new Error("Download queue item not found");
    }

    // Business logic: Remove from torrent client if torrent hash exists
    if (item.torrentHash && deleteTorrent && this.torrentClient) {
      try {
        await this.torrentClient.removeTorrent(item.torrentHash, deleteTorrent);
        this.logger.info(
          { torrentHash: item.torrentHash },
          "Removed torrent from client"
        );
      } catch (error) {
        this.logger.error(
          { error, torrentHash: item.torrentHash },
          "Failed to remove torrent from client"
        );
      }
    }

    await this.downloadQueueRepository.delete(id);
    this.logger.info({ id }, "Removed from queue");
  }

  /**
   * Pause download
   * Business logic: Pause torrent in client and update status
   */
  async pauseDownload(id: string) {
    this.logger.info({ id }, "Pausing download");

    const item = await this.downloadQueueRepository.findById(id);
    if (!item) {
      throw new Error("Download queue item not found");
    }

    if (item.torrentHash && this.torrentClient) {
      try {
        await this.torrentClient.pauseTorrent(item.torrentHash);
        this.logger.info({ id, torrentHash: item.torrentHash }, "Paused torrent in client");
      } catch (error) {
        this.logger.error({ error, id }, "Failed to pause torrent");
      }
    }

    await this.downloadQueueRepository.update(id, { status: "paused" });
    this.logger.info({ id }, "Download paused");
  }

  /**
   * Resume download
   * Business logic: Resume torrent in client and update status
   */
  async resumeDownload(id: string) {
    this.logger.info({ id }, "Resuming download");

    const item = await this.downloadQueueRepository.findById(id);
    if (!item) {
      throw new Error("Download queue item not found");
    }

    if (item.torrentHash && this.torrentClient) {
      try {
        await this.torrentClient.resumeTorrent(item.torrentHash);
        this.logger.info({ id, torrentHash: item.torrentHash }, "Resumed torrent in client");
      } catch (error) {
        this.logger.error({ error, id }, "Failed to resume torrent");
      }
    }

    await this.downloadQueueRepository.update(id, { status: "downloading" });
    this.logger.info({ id }, "Download resumed");
  }

  /**
   * Get unified downloads
   * Business logic: Merge database queue items with real-time torrent client data
   * Complex status determination based on torrent state
   */
  async getUnifiedDownloads(): Promise<UnifiedDownload[]> {
    this.logger.debug("Fetching unified downloads");

    // Get all queue items with full details
    const queueItems = await this.downloadQueueRepository.findAllWithFullDetails();

    // Get torrents from torrent client if available
    let torrentsMap = new Map<string, unknown>();
    if (this.torrentClient) {
      try {
        const torrents = await this.torrentClient.getTorrents();
        // Normalize hashes to lowercase for consistent matching
        torrentsMap = new Map(torrents.map((t) => [t.hash.toLowerCase(), t]));
        this.logger.debug({ torrentsCount: torrents.length }, "Fetched torrents from client");
      } catch (error: unknown) {
        this.logger.error({ error }, "Failed to fetch torrents from client");
      }
    } else {
      this.logger.warn("Torrent client not available - download status will be based on database only");
    }

    // Business logic: Merge data and determine unified status
    const unifiedDownloads = queueItems.map((item) => {
      // Normalize qbitHash to lowercase for matching with torrentsMap keys
      const torrent = item.qbitHash
        ? (torrentsMap.get(item.qbitHash.toLowerCase()) as Record<string, unknown> | undefined)
        : null;
      const scene = item.scene;
      const studio = scene?.site;

      // Determine unified status based on torrent state
      let status: DownloadStatus = item.status as DownloadStatus;
      if (torrent) {
        const torrentState = torrent.state as string | undefined;
        const torrentProgress = torrent.progress as number | undefined;

        // Business rule: Map torrent client states to our status
        if (torrentState === "pausedDL" || torrentState === "pausedUP") {
          status = "paused";
        } else if (torrentState === "queuedDL" || torrentState === "queuedUP") {
          status = "queued";
        } else if (torrentState === "stalledDL") {
          status = "downloading"; // Still downloading but no seeds/peers
        } else if (torrentState === "stalledUP") {
          status = "seeding"; // Still seeding but no leechers
        } else if (torrentState === "checkingDL" || torrentState === "checkingUP") {
          status = "downloading"; // Checking data
        } else if (torrentState?.includes("DL") || torrentState === "metaDL") {
          status = "downloading";
        } else if (torrentState?.includes("UP") || torrentState === "uploading") {
          status = "seeding";
        } else if (torrentProgress !== undefined && torrentProgress >= 1.0) {
          status = "completed";
        }
      }

      return {
        id: item.id,
        sceneId: item.sceneId,
        sceneTitle: scene?.title || item.title,
        scenePoster: scene?.images?.[0]?.url || null,
        sceneStudio: studio?.name || null,
        qbitHash: item.qbitHash,
        status,
        progress: torrent
          ? (torrent.progress as number | undefined) ?? null
          : item.status === "completed"
            ? 1
            : null,
        downloadSpeed: torrent ? (torrent.dlspeed as number | undefined) ?? null : null,
        uploadSpeed: torrent ? (torrent.upspeed as number | undefined) ?? null : null,
        eta: torrent ? (torrent.eta as number | undefined) ?? null : null,
        ratio: torrent ? (torrent.ratio as number | undefined) ?? null : null,
        size: item.size,
        seeders: (torrent?.num_seeds as number | undefined) || item.seeders,
        leechers: (torrent?.num_leechs as number | undefined) || 0,
        quality: item.quality,
        priority: (torrent?.priority as number | undefined) || null,
        addedAt: item.addedAt,
        completedAt: item.completedAt,
        // Retry tracking for failed torrents
        addToClientAttempts: item.addToClientAttempts ?? null,
        addToClientLastAttempt: item.addToClientLastAttempt ?? null,
        addToClientError: item.addToClientError ?? null,
      };
    });

    this.logger.info({ count: unifiedDownloads.length }, "Generated unified downloads");

    return unifiedDownloads;
  }

  /**
   * Try to add torrent to torrent client with proper error handling
   * Returns true if successful, false otherwise
   * @private
   */
  private async tryAddToQbittorrent(
    queueItemId: string,
    options: {
      magnetLink?: string;
      torrentUrl?: string;
      torrentHash?: string;
      savePath?: string;
    }
  ): Promise<boolean> {
    const item = await this.downloadQueueRepository.findById(queueItemId);
    if (!item) throw new Error("Queue item not found");

    const currentAttempts = (item.addToClientAttempts || 0) + 1;

    try {
      this.logger.info(
        {
          queueItemId,
          attempt: currentAttempts,
          magnetLink: !!options.magnetLink,
          torrentUrl: !!options.torrentUrl,
          torrentHash: options.torrentHash,
        },
        "Attempting to add torrent to client"
      );

      // Use addTorrentAndGetHash to get the torrent client hash immediately
      const qbitHash = await this.torrentClient!.addTorrentAndGetHash(
        {
          magnetLinks: options.magnetLink ? [options.magnetLink] : undefined,
          urls: options.torrentUrl ? [options.torrentUrl] : undefined,
          savePath: options.savePath,
          category: "eros",
          paused: false,
          matchInfoHash: options.torrentHash,
          matchTitle: item.title,
        },
        10000 // 10 second timeout
      );

      if (qbitHash) {
        // SUCCESS: Update status to "downloading" and save qbitHash
        this.logger.info(
          { queueItemId, qbitHash },
          "Successfully added to client, saved qbitHash"
        );
        await this.downloadQueueRepository.updateRetryTracking(queueItemId, {
          addToClientAttempts: currentAttempts,
          addToClientLastAttempt: new Date().toISOString(),
          addToClientError: null,
          status: "downloading",
          qbitHash, // Save the torrent client hash
        });
        return true;
      } else {
        // FAILURE: Torrent client returned false or hash not found
        throw new Error("Torrent client addTorrent failed or hash not found");
      }
    } catch (error) {
      // FAILURE: Exception thrown
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        {
          queueItemId,
          attempt: currentAttempts,
          error: errorMessage,
        },
        "Failed to add torrent to client"
      );

      await this.downloadQueueRepository.updateRetryTracking(queueItemId, {
        addToClientAttempts: currentAttempts,
        addToClientLastAttempt: new Date().toISOString(),
        addToClientError: errorMessage,
        status: "add_failed",
      });

      return false;
    }
  }

  /**
   * Retry failed torrents (called by torrent-monitor job)
   * @param maxAttempts - Maximum number of retry attempts allowed (default: 5)
   * @returns Result object with total, succeeded, and permanentFailures counts
   */
  async retryFailedTorrents(maxAttempts: number = 5) {
    this.logger.info({ maxAttempts }, "Retrying failed torrents");

    // Respect Prowlarr rate limits: 5-10 monitor jobs = 25-50 minutes
    // We use 5 minutes minimum between retries
    const retryAfterMinutes = 5;
    const failedItems = await this.downloadQueueRepository.findAddFailedItems(
      maxAttempts,
      retryAfterMinutes
    );

    this.logger.info({ count: failedItems.length }, "Found failed torrents to retry");

    let successCount = 0;
    let permanentFailures = 0;

    for (const item of failedItems) {
      const shouldRetry = (item.addToClientAttempts || 0) < maxAttempts;

      if (!shouldRetry) {
        this.logger.warn(
          { id: item.id, attempts: item.addToClientAttempts },
          "Max retry attempts reached, giving up"
        );
        permanentFailures++;
        continue;
      }

      // Reconstruct magnet link if torrentHash is available
      const magnetLink = item.torrentHash
        ? `magnet:?xt=urn:btih:${item.torrentHash}&dn=${encodeURIComponent(item.title)}`
        : undefined;

      const success = await this.tryAddToQbittorrent(item.id, {
        magnetLink,
        torrentHash: item.torrentHash || undefined,
      });

      if (success) {
        successCount++;
      }
    }

    this.logger.info(
      {
        total: failedItems.length,
        succeeded: successCount,
        permanentFailures,
      },
      "Retry operation completed"
    );

    return {
      total: failedItems.length,
      succeeded: successCount,
      permanentFailures,
    };
  }

  /**
   * Manually retry a single failed torrent
   * @param id - Download queue item ID
   * @returns Result object with id, success, and status
   */
  async retrySingleTorrent(id: string) {
    this.logger.info({ id }, "Manually retrying failed torrent");

    const item = await this.downloadQueueRepository.findById(id);
    if (!item) {
      throw new Error("Download queue item not found");
    }

    if (item.status !== "add_failed") {
      throw new Error("Torrent is not in add_failed status");
    }

    const magnetLink = item.torrentHash
      ? `magnet:?xt=urn:btih:${item.torrentHash}&dn=${encodeURIComponent(item.title)}`
      : undefined;

    const success = await this.tryAddToQbittorrent(id, {
      magnetLink,
      torrentHash: item.torrentHash || undefined,
    });

    return {
      id,
      success,
      status: success ? ("downloading" as const) : ("add_failed" as const),
    };
  }
}
