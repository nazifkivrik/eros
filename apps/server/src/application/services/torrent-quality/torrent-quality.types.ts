/**
 * Torrent Quality Service Types
 */

/**
 * Torrent result with parsed quality information
 */
export type ParsedTorrent = {
  title: string;
  magnetLink: string;
  size: number; // in bytes
  seeders: number;
  leechers: number;
  indexerId: string;
  indexerName: string;
  category: string;
  publishDate?: string;
  quality: string; // "2160p", "1080p", "720p", "480p", "any"
  source: string; // "bluray", "webdl", "webrip", "hdtv", "dvd", "any"
  matchScore: number; // 0-100, fuzzy match score
};

/**
 * Quality profile item from database
 */
export type QualityProfileItem = {
  quality: string;
  source: string;
  minSeeders: number | "any";
  maxSize: number; // in GB
};

/**
 * Quality profile with items
 */
export type QualityProfile = {
  id: string;
  name: string;
  items: QualityProfileItem[];
};
