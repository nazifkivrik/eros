import type { Logger } from "pino";
import { nanoid } from "nanoid";
import type { DownloadStatus } from "@repo/shared-types";
import { DownloadQueueRepository } from "../../infrastructure/repositories/download-queue.repository.js";
import type { QBittorrentService } from "../../services/qbittorrent.service.js";

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
}

/**
 * Download Queue Service (Clean Architecture)
 * Business logic for download queue management
 * Handles: Queue CRUD, qBittorrent integration, unified downloads
 */
export class DownloadQueueService {
  private downloadQueueRepository: DownloadQueueRepository;
  private qbittorrentService: QBittorrentService | undefined;
  private logger: Logger;

  constructor({
    downloadQueueRepository,
    qbittorrentService,
    logger,
  }: {
    downloadQueueRepository: DownloadQueueRepository;
    qbittorrentService?: QBittorrentService;
    logger: Logger;
  }) {
    this.downloadQueueRepository = downloadQueueRepository;
    this.qbittorrentService = qbittorrentService;
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
   * - Optionally start download in qBittorrent
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

    // Business logic: If magnetLink provided and qBittorrent available, add torrent
    if (dto.magnetLink && this.qbittorrentService) {
      try {
        await this.qbittorrentService.addTorrent({
          magnetLinks: [dto.magnetLink],
          category: "eros",
          paused: false,
        });

        this.logger.info({ sceneId: dto.sceneId, title: dto.title }, "Added torrent to qBittorrent");
      } catch (error) {
        this.logger.error(
          { error, sceneId: dto.sceneId, title: dto.title },
          "Failed to add torrent to qBittorrent"
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
   * Business logic: Optionally delete torrent from qBittorrent
   */
  async removeFromQueue(id: string, deleteTorrent: boolean = false) {
    this.logger.info({ id, deleteTorrent }, "Removing from queue");

    const item = await this.downloadQueueRepository.findById(id);
    if (!item) {
      throw new Error("Download queue item not found");
    }

    // Business logic: Remove from qBittorrent if torrent hash exists
    if (item.torrentHash && deleteTorrent && this.qbittorrentService) {
      try {
        await this.qbittorrentService.removeTorrent(item.torrentHash, deleteTorrent);
        this.logger.info(
          { torrentHash: item.torrentHash },
          "Removed torrent from qBittorrent"
        );
      } catch (error) {
        this.logger.error(
          { error, torrentHash: item.torrentHash },
          "Failed to remove torrent from qBittorrent"
        );
      }
    }

    await this.downloadQueueRepository.delete(id);
    this.logger.info({ id }, "Removed from queue");
  }

  /**
   * Pause download
   * Business logic: Pause torrent in qBittorrent and update status
   */
  async pauseDownload(id: string) {
    this.logger.info({ id }, "Pausing download");

    const item = await this.downloadQueueRepository.findById(id);
    if (!item) {
      throw new Error("Download queue item not found");
    }

    if (item.torrentHash && this.qbittorrentService) {
      try {
        await this.qbittorrentService.pauseTorrent(item.torrentHash);
        this.logger.info({ id, torrentHash: item.torrentHash }, "Paused torrent in qBittorrent");
      } catch (error) {
        this.logger.error({ error, id }, "Failed to pause torrent");
      }
    }

    await this.downloadQueueRepository.update(id, { status: "paused" });
    this.logger.info({ id }, "Download paused");
  }

  /**
   * Resume download
   * Business logic: Resume torrent in qBittorrent and update status
   */
  async resumeDownload(id: string) {
    this.logger.info({ id }, "Resuming download");

    const item = await this.downloadQueueRepository.findById(id);
    if (!item) {
      throw new Error("Download queue item not found");
    }

    if (item.torrentHash && this.qbittorrentService) {
      try {
        await this.qbittorrentService.resumeTorrent(item.torrentHash);
        this.logger.info({ id, torrentHash: item.torrentHash }, "Resumed torrent in qBittorrent");
      } catch (error) {
        this.logger.error({ error, id }, "Failed to resume torrent");
      }
    }

    await this.downloadQueueRepository.update(id, { status: "downloading" });
    this.logger.info({ id }, "Download resumed");
  }

  /**
   * Get unified downloads
   * Business logic: Merge database queue items with real-time qBittorrent torrent data
   * Complex status determination based on torrent state
   */
  async getUnifiedDownloads(): Promise<UnifiedDownload[]> {
    this.logger.debug("Fetching unified downloads");

    // Get all queue items with full details
    const queueItems = await this.downloadQueueRepository.findAllWithFullDetails();

    // Get torrents from qBittorrent if available
    let torrentsMap = new Map<string, unknown>();
    if (this.qbittorrentService) {
      try {
        const torrents = await this.qbittorrentService.getTorrents();
        torrentsMap = new Map(torrents.map((t) => [t.hash, t]));
        this.logger.debug({ torrentsCount: torrents.length }, "Fetched torrents from qBittorrent");
      } catch (error: unknown) {
        this.logger.error({ error }, "Failed to fetch torrents from qBittorrent");
      }
    }

    // Business logic: Merge data and determine unified status
    const unifiedDownloads = queueItems.map((item) => {
      const torrent = item.qbitHash
        ? (torrentsMap.get(item.qbitHash) as Record<string, unknown> | undefined)
        : null;
      const scene = item.scene;
      const studio = scene?.site;

      // Determine unified status based on torrent state
      let status: DownloadStatus = item.status as DownloadStatus;
      if (torrent) {
        const torrentState = torrent.state as string | undefined;
        const torrentProgress = torrent.progress as number | undefined;

        // Business rule: Map qBittorrent states to our status
        if (torrentState === "pausedDL") {
          status = "paused";
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
      };
    });

    this.logger.info({ count: unifiedDownloads.length }, "Generated unified downloads");

    return unifiedDownloads;
  }
}
