/**
 * ITorrentClient Interface
 * Abstraction for torrent client services (qBittorrent, Transmission, Deluge, etc.)
 * Allows swapping torrent client implementations without changing business logic
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
  numSeeds: number;
  numLeechers: number;
}

export interface TorrentProperties {
  savePath: string;
  contentPath: string;
  creationDate: number;
  pieceSize: number;
  comment: string;
  totalWasted: number;
  totalUploaded: number;
  totalUploadedSession: number;
  totalDownloaded: number;
  totalDownloadedSession: number;
  upLimit: number;
  dlLimit: number;
  timeElapsed: number;
  seedingTime: number;
  nbConnections: number;
  nbConnectionsLimit: number;
  shareRatio: number;
}

export interface AddTorrentOptions {
  urls?: string[];
  magnetLinks?: string[];
  category?: string;
  savePath?: string;
  paused?: boolean;
}

export interface ITorrentClient {
  /**
   * Unique identifier for this torrent client implementation
   */
  readonly name: string;

  /**
   * Get all torrents with optional filtering
   * @param filter - Optional filter (e.g., "active", "paused", "completed")
   * @param category - Optional category to filter by
   * @returns Array of torrent info
   */
  getTorrents(filter?: string, category?: string): Promise<TorrentInfo[]>;

  /**
   * Get detailed properties for a specific torrent
   * @param hash - Torrent hash identifier
   * @returns Torrent properties
   */
  getTorrentProperties(hash: string): Promise<TorrentProperties>;

  /**
   * Add a torrent to the client
   * @param options - Torrent addition options
   * @returns true if successful
   */
  addTorrent(options: AddTorrentOptions): Promise<boolean>;

  /**
   * Add a torrent and wait for it to appear, then return its hash
   * Useful for immediately storing the hash in the database
   * @param options - Torrent addition options
   * @param timeout - Maximum time to wait in ms (default: 10000)
   * @returns The torrent hash, or null if not found within timeout
   */
  addTorrentAndGetHash(
    options: AddTorrentOptions & {
      matchInfoHash?: string;
      matchTitle?: string;
    },
    timeout?: number
  ): Promise<string | null>;

  /**
   * Pause a torrent
   * @param hash - Torrent hash identifier
   * @returns true if successful
   */
  pauseTorrent(hash: string): Promise<boolean>;

  /**
   * Resume a paused torrent
   * @param hash - Torrent hash identifier
   * @returns true if successful
   */
  resumeTorrent(hash: string): Promise<boolean>;

  /**
   * Remove a torrent from the client
   * @param hash - Torrent hash identifier
   * @param deleteFiles - Whether to delete downloaded files
   * @returns true if successful
   */
  removeTorrent(hash: string, deleteFiles?: boolean): Promise<boolean>;

  /**
   * Set speed limits for a torrent
   * @param hash - Torrent hash identifier
   * @param downloadLimit - Optional download limit in bytes/s
   * @param uploadLimit - Optional upload limit in bytes/s
   * @returns true if successful
   */
  setSpeedLimit(
    hash: string,
    downloadLimit?: number,
    uploadLimit?: number
  ): Promise<boolean>;

  /**
   * Set torrent priority in queue
   * @param hash - Torrent hash identifier
   * @param priority - Priority: "top", "bottom", or a number (higher = higher priority)
   * @returns true if successful
   */
  setTorrentPriority(
    hash: string,
    priority: "top" | "bottom" | number
  ): Promise<boolean>;

  /**
   * Delete a torrent (alias for removeTorrent)
   * @param hash - Torrent hash identifier
   * @param deleteFiles - Whether to delete downloaded files
   * @returns true if successful
   */
  deleteTorrent(hash: string, deleteFiles?: boolean): Promise<boolean>;

  /**
   * Set global download/upload speed limits
   * @param downloadLimit - Optional download limit in bytes/s (0 or undefined = unlimited)
   * @param uploadLimit - Optional upload limit in bytes/s (0 or undefined = unlimited)
   * @returns true if successful
   */
  setGlobalSpeedLimits(
    downloadLimit?: number,
    uploadLimit?: number
  ): Promise<boolean>;

  /**
   * Test connection to the torrent client
   * @returns true if connection successful, false otherwise
   */
  testConnection(): Promise<boolean>;
}
