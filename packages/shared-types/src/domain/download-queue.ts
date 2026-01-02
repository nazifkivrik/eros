import type { DownloadStatus } from "../api/download-queue.js";
import type { Resolution } from "../api/quality-profile.js";

/**
 * Download queue item (unified type)
 * Represents a scene queued or actively downloading
 */
export type DownloadQueueItemDomain = {
  id: string;
  sceneId: string;
  torrentHash: string | null;
  title: string;
  size: number;
  seeders: number;
  quality: Resolution;
  status: DownloadStatus;
  progress?: number;
  addedAt: string;
  completedAt: string | null;
};
