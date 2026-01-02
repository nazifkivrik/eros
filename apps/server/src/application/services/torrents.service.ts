import type { Logger } from "pino";
import type { QBittorrentService } from "../../services/qbittorrent.service.js";

/**
 * DTOs for Torrents Service
 */
export interface TorrentInfo {
  hash: string;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  ratio: number;
  state: string;
  category: string;
  savePath: string;
  addedOn: number;
  completionOn: number;
  seeders: number;
  leechers: number;
}

export type TorrentPriority = "increase" | "decrease" | "top" | "bottom";

/**
 * Torrents Service (Clean Architecture)
 * Business logic for torrent management via qBittorrent
 *
 * Note: This service delegates to the external QBittorrentService
 * No database interaction required - all state managed by qBittorrent
 */
export class TorrentsService {
  private qbittorrentService: QBittorrentService | undefined;
  private logger: Logger;

  constructor({
    qbittorrentService,
    logger,
  }: {
    qbittorrentService?: QBittorrentService;
    logger: Logger;
  }) {
    this.qbittorrentService = qbittorrentService;
    this.logger = logger;
  }

  /**
   * Check if qBittorrent is configured
   * Business rule: Operations require qBittorrent to be configured
   */
  private ensureQBittorrentAvailable(): void {
    if (!this.qbittorrentService) {
      throw new Error("qBittorrent not configured");
    }
  }

  /**
   * Get all active torrents
   * Business logic: Map qBittorrent's format to our internal format
   */
  async getAllTorrents(): Promise<{ torrents: TorrentInfo[]; total: number }> {
    if (!this.qbittorrentService) {
      this.logger.warn("qBittorrent not configured, returning empty list");
      return { torrents: [], total: 0 };
    }

    this.logger.debug("Fetching all torrents from qBittorrent");

    const torrents = await this.qbittorrentService.getTorrents();
    const mapped = torrents.map((t) =>
      this.qbittorrentService!.mapTorrentInfo(t)
    );

    this.logger.info({ count: mapped.length }, "Fetched torrents");

    return {
      torrents: mapped,
      total: mapped.length,
    };
  }

  /**
   * Pause a torrent
   * Business rule: Returns false if torrent not found, true on success
   */
  async pauseTorrent(hash: string): Promise<boolean> {
    this.ensureQBittorrentAvailable();

    this.logger.info({ hash }, "Pausing torrent");

    const success = await this.qbittorrentService!.pauseTorrent(hash);

    if (!success) {
      this.logger.warn({ hash }, "Torrent not found");
      return false;
    }

    this.logger.info({ hash }, "Torrent paused");
    return true;
  }

  /**
   * Resume a paused torrent
   * Business rule: Returns false if torrent not found, true on success
   */
  async resumeTorrent(hash: string): Promise<boolean> {
    this.ensureQBittorrentAvailable();

    this.logger.info({ hash }, "Resuming torrent");

    const success = await this.qbittorrentService!.resumeTorrent(hash);

    if (!success) {
      this.logger.warn({ hash }, "Torrent not found");
      return false;
    }

    this.logger.info({ hash }, "Torrent resumed");
    return true;
  }

  /**
   * Remove a torrent
   * Business rule: Optionally delete files along with the torrent
   */
  async removeTorrent(
    hash: string,
    deleteFiles: boolean = false
  ): Promise<boolean> {
    this.ensureQBittorrentAvailable();

    this.logger.info({ hash, deleteFiles }, "Removing torrent");

    const success = await this.qbittorrentService!.removeTorrent(
      hash,
      deleteFiles
    );

    if (!success) {
      this.logger.warn({ hash }, "Torrent not found");
      return false;
    }

    this.logger.info({ hash, deleteFiles }, "Torrent removed");
    return true;
  }

  /**
   * Change torrent priority
   * Business rule: Priority affects download order (top, bottom, increase, decrease)
   */
  async setTorrentPriority(
    hash: string,
    priority: TorrentPriority
  ): Promise<boolean> {
    this.ensureQBittorrentAvailable();

    this.logger.info({ hash, priority }, "Setting torrent priority");

    const success = await this.qbittorrentService!.setTorrentPriority(
      hash,
      priority
    );

    if (!success) {
      this.logger.warn({ hash }, "Torrent not found");
      return false;
    }

    this.logger.info({ hash, priority }, "Torrent priority updated");
    return true;
  }
}
