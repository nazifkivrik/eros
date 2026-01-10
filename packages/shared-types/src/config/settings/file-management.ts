/**
 * File management settings
 */
export type FileManagementSettings = {
  deleteFilesOnRemove: boolean; // Re-download scene when files are manually deleted from filesystem
  deleteTorrentOnRemove: boolean; // Re-add torrent when manually removed from qBittorrent
  removeFromQbitAfterDays: number;
  renameOnMetadata: boolean;
};

export const DEFAULT_FILE_MANAGEMENT_SETTINGS: FileManagementSettings = {
  deleteFilesOnRemove: false, // Don't re-download by default
  deleteTorrentOnRemove: false, // Don't re-add by default (will unsubscribe)
  removeFromQbitAfterDays: 7,
  renameOnMetadata: true,
};
