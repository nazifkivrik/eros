/**
 * Download Paths Settings
 * Manages multiple download locations with intelligent selection
 */

/**
 * A single download path configuration
 */
export type DownloadPath = {
  id: string;
  name: string; // User-defined name, e.g., "HDD 1", "SSD"
  path: string; // Docker volume mount path, e.g., "/mnt/ssd/downloads"
  priority: number; // For manual ordering (lower = higher priority)
  isDefault?: boolean; // Mark as default for manual selections
};

/**
 * Selection mode for download paths
 */
export type DownloadPathSelectionMode = "most-space" | "round-robin" | "priority";

/**
 * Complete download paths settings
 */
export type DownloadPathsSettings = {
  paths: DownloadPath[];
  selectionMode: DownloadPathSelectionMode;
};

/**
 * Default download paths settings
 */
export const DEFAULT_DOWNLOAD_PATHS_SETTINGS: DownloadPathsSettings = {
  paths: [
    {
      id: "default",
      name: "Default",
      path: "/downloads",
      priority: 0,
      isDefault: true,
    },
  ],
  selectionMode: "most-space",
};

/**
 * Disk space information for a path
 */
export type PathSpaceInfo = {
  path: string;
  free: number; // bytes
  total: number; // bytes
  used: number; // bytes
  freePercent: number; // 0-100
  usedPercent: number; // 0-100
};
