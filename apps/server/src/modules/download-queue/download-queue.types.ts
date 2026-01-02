import type {
  DownloadQueueItem,
  DownloadStatus,
  Resolution,
} from "@repo/shared-types";

export type DownloadQueueWithScene = DownloadQueueItem & {
  scene: {
    id: string;
    title: string;
    externalIds: Array<{ source: string; id: string }>;
    images: Array<{ url: string; width?: number; height?: number }>;
  } | null;
};

export type AddToQueueParams = {
  sceneId: string;
  title: string;
  size: number;
  seeders: number;
  quality: Resolution;
  magnetLink?: string;
};

export type UpdateQueueItemParams = {
  status?: DownloadStatus;
  torrentHash?: string;
  completedAt?: string;
};

// Re-export DownloadStatus for convenience
export type { DownloadStatus };
