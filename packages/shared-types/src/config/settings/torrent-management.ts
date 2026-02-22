/**
 * Automatic Torrent Management Settings
 * Manages pause/retry behavior for slow or stalled torrents
 */

/**
 * Pause reason for auto-paused torrents
 */
export type AutoPauseReason = "stalled" | "metadata" | "slow" | "no_activity";

/**
 * Retry behavior modes
 */
export type RetryBehavior = "queue_empty" | "immediate" | "delayed";

/**
 * Stall threshold settings
 */
export type StallThreshold = {
  maxSeeders: number; // Pause if seeders <= this
  minSpeed: number; // Bytes/s - pause if speed < this AND seeders < threshold
};

/**
 * Automatic torrent management settings
 */
export type TorrentAutoManagementSettings = {
  // Master toggle
  enabled: boolean;

  // Pause conditions
  pauseOnStalled: boolean;
  stallThreshold: StallThreshold;

  pauseOnMetadataStuck: boolean;
  metadataTimeoutMinutes: number;

  pauseOnSlowSpeed: boolean;
  slowSpeedThreshold: number; // Bytes/s
  slowSpeedDurationMinutes: number;

  pauseOnNoActivity: boolean;
  noActivityMinutes: number;

  // Retry behavior
  maxRetries: number;
  retryBehavior: RetryBehavior;
  retryDelayMinutes: number;

  // Priority system
  useCombinedPriority: boolean;
  retryCountWeight: number; // How much to weight retry count vs queue position
};

/**
 * Default torrent auto-management settings
 */
export const DEFAULT_TORRENT_AUTO_MANAGEMENT: TorrentAutoManagementSettings = {
  enabled: false,

  pauseOnStalled: true,
  stallThreshold: {
    maxSeeders: 0,
    minSpeed: 10240, // 10 KB/s
  },

  pauseOnMetadataStuck: true,
  metadataTimeoutMinutes: 30,

  pauseOnSlowSpeed: false,
  slowSpeedThreshold: 5120, // 5 KB/s
  slowSpeedDurationMinutes: 10,

  pauseOnNoActivity: true,
  noActivityMinutes: 15,

  maxRetries: 3,
  retryBehavior: "queue_empty",
  retryDelayMinutes: 5,

  useCombinedPriority: true,
  retryCountWeight: 100,
};
