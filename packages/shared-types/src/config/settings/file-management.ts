/**
 * File management settings
 */
export type FileManagementSettings = {
  deleteFilesOnRemove: boolean; // Re-download scene when files are manually deleted from filesystem
  deleteTorrentOnRemove: boolean; // Re-add torrent when manually removed from qBittorrent
  removeFromQbitAfterDays: number;
  renameOnMetadata: boolean;
  autoRedownloadDeletedScenes: boolean; // Auto re-download scenes when files are deleted
  readdManuallyRemovedTorrents: boolean; // Re-add torrents when manually removed from qBittorrent
};

export const DEFAULT_FILE_MANAGEMENT_SETTINGS: FileManagementSettings = {
  deleteFilesOnRemove: false, // Don't re-download by default
  deleteTorrentOnRemove: false, // Don't re-add by default (will unsubscribe)
  removeFromQbitAfterDays: 7,
  renameOnMetadata: true,
  autoRedownloadDeletedScenes: false, // Don't auto re-download by default
  readdManuallyRemovedTorrents: false, // Don't re-add by default
};
