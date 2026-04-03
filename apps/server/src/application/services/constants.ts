/**
 * Application Constants
 * Centralized magic numbers with descriptive names
 * Follows AGENTS.md naming conventions: UPPER_SNAKE_CASE for constants
 */

// Timeout values in milliseconds
export const TIMEOUTS = {
  /** Default timeout for general requests (30 seconds) */
  REQUEST: 30_000,
  /** Timeout for qBittorrent login (15 seconds) */
  QBITTORRENT_LOGIN: 15_000,
  /** Default timeout for addTorrentAndGetHash (15 seconds) */
  QBITTORRENT_ADD_TORRENT: 15_000,
} as const;

// Polling intervals in milliseconds
export const POLLING = {
  /** Initial polling interval (300ms) */
  INITIAL_INTERVAL: 300,
  /** Maximum polling interval for exponential backoff (2.4 seconds) */
  MAX_INTERVAL: 2_400,
} as const;

// ETA (Estimated Time of Arrival) values in seconds
export const ETA = {
  /** Maximum valid ETA value (100 days = 8,640,000 seconds) */
  MAX_VALUE: 8_640_000,
  /** Cap for manually calculated ETA (7 days = 604,800 seconds) */
  SEVEN_DAYS: 604_800,
} as const;

// Torrent processing limits
export const TORRENTS = {
  /** Maximum torrents to process per subscription search run */
  MAX_PER_RUN: 50,
  /** Batch size for parallel subscription processing */
  BATCH_SIZE: 5,
} as const;
