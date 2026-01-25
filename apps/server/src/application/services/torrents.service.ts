import type { Logger } from "pino";
import type { ITorrentClient } from "@/infrastructure/adapters/interfaces/torrent-client.interface.js";

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
 * Business logic for torrent management via torrent client
 *
 * Note: This service delegates to ITorrentClient adapter
 * No database interaction required - all state managed by torrent client
 */
export class TorrentsService {
  private torrentClient?: ITorrentClient;
  private logger: Logger;

  constructor({
    torrentClient,
    logger,
  }: {
    torrentClient?: ITorrentClient;
    logger: Logger;
  }) {
    this.torrentClient = torrentClient;
    this.logger = logger;
  }

  /**
   * Check if torrent client is configured
   * Business rule: Operations require torrent client to be configured
   */
  private ensureTorrentClientAvailable(): void {
    if (!this.torrentClient) {
      throw new Error("Torrent client not configured");
    }
  }

  /**
   * Get all active torrents
   * Business logic: Map torrent client's format to our internal format
   */
  async getAllTorrents(): Promise<{ torrents: TorrentInfo[]; total: number }> {
    if (!this.torrentClient) {
      this.logger.warn("Torrent client not configured, returning empty list");
      return { torrents: [], total: 0 };
    }

    this.logger.debug("Fetching all torrents from client");

    const torrents = await this.torrentClient.getTorrents();

    // Map ITorrentClient format to our TorrentInfo format
    const mapped: TorrentInfo[] = torrents.map((t) => ({
      hash: t.hash,
      name: t.name,
      size: t.size,
      progress: t.progress,
      downloadSpeed: t.downloadSpeed,
      uploadSpeed: t.uploadSpeed,
      eta: t.eta,
      ratio: t.ratio,
      state: t.state,
      category: t.category,
      savePath: t.savePath,
      addedOn: t.addedOn,
      completionOn: t.completionOn,
      seeders: t.numSeeds,
      leechers: t.numLeechers,
    }));

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
    this.ensureTorrentClientAvailable();

    this.logger.info({ hash }, "Pausing torrent");

    const success = await this.torrentClient!.pauseTorrent(hash);

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
    this.ensureTorrentClientAvailable();

    this.logger.info({ hash }, "Resuming torrent");

    const success = await this.torrentClient!.resumeTorrent(hash);

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
    this.ensureTorrentClientAvailable();

    this.logger.info({ hash, deleteFiles }, "Removing torrent");

    const success = await this.torrentClient!.removeTorrent(hash, deleteFiles);

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
   * Note: Not all torrent clients support this operation
   */
  async setTorrentPriority(
    hash: string,
    priority: TorrentPriority
  ): Promise<boolean> {
    this.ensureTorrentClientAvailable();

    this.logger.info({ hash, priority }, "Setting torrent priority");

    // Check if torrent client supports priority operations
    // For qBittorrent, this is a specific feature that may not be in ITorrentClient interface
    // We'll need to extend the interface or handle this differently

    this.logger.warn({ hash, priority }, "Torrent priority operation not supported by adapter interface yet");
    return false;
  }
}
