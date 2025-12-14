import type { DownloadStatus } from "@repo/shared-types";

// Note: DownloadQueueItem here differs slightly from shared-types version
// This version uses 'quality: string' while shared version uses 'quality: Quality'
// Keeping this for backend-specific use
export type DownloadQueueItem = {
  id: string;
  sceneId: string;
  torrentHash: string | null;
  indexerId: string;
  title: string;
  size: number;
  seeders: number;
  quality: string;
  status: DownloadStatus;
  addedAt: string;
  completedAt: string | null;
};

export type DownloadQueueWithScene = DownloadQueueItem & {
  scene: {
    id: string;
    title: string;
    stashdbId: string | null;
    images: Array<{ url: string; width?: number; height?: number }>;
  } | null;
};

export type AddToQueueParams = {
  sceneId: string;
  indexerId: string;
  title: string;
  size: number;
  seeders: number;
  quality: string;
  magnetLink?: string;
};

export type UpdateQueueItemParams = {
  status?: DownloadStatus;
  torrentHash?: string;
  completedAt?: string;
};

// Re-export DownloadStatus for convenience
export type { DownloadStatus };
