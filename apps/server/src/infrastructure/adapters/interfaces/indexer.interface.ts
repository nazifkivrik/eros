/**
 * IIndexer Interface
 * Abstraction for torrent indexer services (Prowlarr, Jackett, etc.)
 * Allows swapping indexer implementations without changing business logic
 */

export interface IndexerInfo {
  id: string;
  name: string;
  enable: boolean;
  priority: number;
  categories: number[];
}

export interface TorrentSearchResult {
  guid: string;
  title: string;
  size: number;
  seeders: number;
  leechers?: number;
  indexerId: number;
  indexer: string;
  downloadUrl: string;
  magnetUrl?: string;
  infoUrl?: string;
  infoHash: string;
  publishDate?: string;
  protocol: "torrent" | "usenet";
  categories: number[];
}

export interface SearchOptions {
  limit?: number;
  categories?: number[];
  type?: "search" | "tvsearch" | "moviesearch";
}

export interface IIndexer {
  /**
   * Unique identifier for this indexer implementation
   */
  readonly name: string;

  /**
   * Search for torrents across all configured indexers
   * @param query - Search query string
   * @param options - Optional search parameters (limit, categories, type)
   * @returns Array of torrent search results
   */
  search(query: string, options?: SearchOptions): Promise<TorrentSearchResult[]>;

  /**
   * Get list of all configured indexers
   * @returns Array of indexer information
   */
  getIndexers(): Promise<IndexerInfo[]>;

  /**
   * Test connection to the indexer service
   * @returns true if connection successful, false otherwise
   */
  testConnection(): Promise<boolean>;

  /**
   * Get indexer configuration for syncing to database
   * @returns Array of indexer configs in database format
   */
  syncIndexers(): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      baseUrl: string;
      apiKey: string;
      priority: number;
      enabled: boolean;
      categories: string[];
    }>
  >;

  /**
   * Get magnet link from download URL via proxy
   * Used when downloadUrl is not already a magnet link
   * @param downloadUrl - The download URL to convert to magnet link
   * @param indexerId - Optional indexer ID for the request
   * @returns Magnet link URL or null if unable to convert
   */
  getMagnetLink?(downloadUrl: string, indexerId?: number): Promise<string | null>;
}
