/**
 * Torrent Search API types
 */

/**
 * Torrent result from search
 */
export type TorrentResult = {
  title: string;
  size: number;
  seeders: number;
  leechers?: number;
  quality: string;
  source: string;
  indexerId: string;
  indexerName: string;
  downloadUrl: string;
  infoHash?: string;
  sceneId?: string;
  indexers?: string[];
  indexerCount?: number;
};

/**
 * Manual search result with match scoring
 */
export type ManualSearchResult = TorrentResult & {
  matchScore: number; // 0-100 percentage
  matchReason: string;
};
