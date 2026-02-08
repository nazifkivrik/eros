import type { Logger } from "pino";
import type { TorrentClientRegistry } from "@/infrastructure/registries/provider-registry.js";

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
 * Note: This service delegates to ITorrentClient adapter via TorrentClientRegistry
 * No database interaction required - all state managed by torrent client
 */
export class TorrentsService {
  private torrentClientRegistry: TorrentClientRegistry;
  private logger: Logger;

  constructor({
    torrentClientRegistry,
    logger,
  }: {
    torrentClientRegistry: TorrentClientRegistry;
    logger: Logger;
  }) {
    this.torrentClientRegistry = torrentClientRegistry;
    this.logger = logger;
  }

  /**
   * Get the primary torrent client
   * Business rule: Operations require torrent client to be configured
   */
  private getTorrentClient() {
    const primary = this.torrentClientRegistry.getPrimary();
    if (!primary) {
      throw new Error("Torrent client not configured");
    }
    return primary.provider;
  }

  /**
   * Check if torrent client is configured
   */
  private isTorrentClientAvailable(): boolean {
    const primary = this.torrentClientRegistry.getPrimary();
    return !!primary;
  }

  /**
   * Get all active torrents
   * Business logic: Map torrent client's format to our internal format
   */
  async getAllTorrents(): Promise<{ torrents: TorrentInfo[]; total: number }> {
    if (!this.isTorrentClientAvailable()) {
      this.logger.warn("Torrent client not configured, returning empty list");
      return { torrents: [], total: 0 };
    }

    this.logger.debug("Fetching all torrents from client");

    const torrentClient = this.getTorrentClient();
    const torrents = await torrentClient.getTorrents();

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
    const torrentClient = this.getTorrentClient();

    this.logger.info({ hash }, "Pausing torrent");

    const success = await torrentClient.pauseTorrent(hash);

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
    const torrentClient = this.getTorrentClient();

    this.logger.info({ hash }, "Resuming torrent");

    const success = await torrentClient.resumeTorrent(hash);

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
    const torrentClient = this.getTorrentClient();

    this.logger.info({ hash, deleteFiles }, "Removing torrent");

    const success = await torrentClient.removeTorrent(hash, deleteFiles);

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
    const torrentClient = this.getTorrentClient();

    this.logger.info({ hash, priority }, "Setting torrent priority");

    // Check if torrent client supports priority operations
    // For qBittorrent, this is a specific feature that may not be in ITorrentClient interface
    // We'll need to extend the interface or handle this differently

    this.logger.warn({ hash, priority }, "Torrent priority operation not supported by adapter interface yet");
    return false;
  }
}
