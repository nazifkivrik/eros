export type DownloadStatus =
  | "queued"
  | "downloading"
  | "completed"
  | "failed"
  | "paused";

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
