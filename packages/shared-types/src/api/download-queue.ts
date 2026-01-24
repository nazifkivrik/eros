import { z } from "zod";
import { ImageSchema } from "./entities.js";

export const DownloadStatusSchema = z.enum([
  "queued",
  "downloading",
  "completed",
  "failed",
  "paused",
  "seeding",
  "add_failed", // Torrent failed to add to qBittorrent
]);

export const SceneFileSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  path: z.string(),
  size: z.number(),
  duration: z.number().nullable(),
  codec: z.string().nullable(),
  resolution: z.string().nullable(),
  bitrate: z.number().nullable(),
  fps: z.number().nullable(),
  audioCodec: z.string().nullable(),
  audioChannels: z.number().nullable(),
  hash: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const SceneSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  externalIds: z.array(z.object({ source: z.string(), id: z.string() })),
  images: z.array(ImageSchema),
});

export const DownloadQueueItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  sceneId: z.string().nullable(),
  torrentHash: z.string().nullable(),
  qbitHash: z.string().nullable(),
  size: z.number(),
  seeders: z.number(),
  quality: z.string(),
  status: DownloadStatusSchema,
  addedAt: z.string(),
  completedAt: z.string().nullable(),
});

export const DownloadQueueItemResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  sceneId: z.string(),
  scene: SceneSummarySchema.nullable(),
  torrentHash: z.string().nullable(),
  qbitHash: z.string().nullable(),
  size: z.number(),
  seeders: z.number(),
  quality: z.string(),
  status: DownloadStatusSchema,
  addedAt: z.string(),
  completedAt: z.string().nullable(),
});

export const EnhancedDownloadItemSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  status: DownloadStatusSchema,
  qbitHash: z.string().nullable(),
  size: z.number(),
  seeders: z.number(),
  leechers: z.number(),
  quality: z.string(),
  sceneTitle: z.string(),
  scenePoster: z.string().nullable(),
  sceneStudio: z.string().nullable(),
  progress: z.number().nullable(),
  downloadSpeed: z.number().nullable(),
  uploadSpeed: z.number().nullable(),
  eta: z.number().nullable(),
  ratio: z.number().nullable(),
  priority: z.number().nullable(),
  addedAt: z.string(),
  completedAt: z.string().nullable(),
  // Retry tracking for failed torrents
  addToClientAttempts: z.number().nullable(),
  addToClientLastAttempt: z.string().nullable(),
  addToClientError: z.string().nullable(),
});

export const DownloadQueueListResponseSchema = z.object({
  data: z.array(DownloadQueueItemResponseSchema),
});

export const EnhancedDownloadsResponseSchema = z.object({
  downloads: z.array(EnhancedDownloadItemSchema),
});

// Tip schema'dan üret
export type DownloadStatus = z.infer<typeof DownloadStatusSchema>;
export type SceneFile = z.infer<typeof SceneFileSchema>;
export type DownloadQueueItem = z.infer<typeof DownloadQueueItemSchema>;
export type DownloadQueueItemResponse = z.infer<typeof DownloadQueueItemResponseSchema>;
export type EnhancedDownloadItem = z.infer<typeof EnhancedDownloadItemSchema>;
export type DownloadQueueListResponse = z.infer<typeof DownloadQueueListResponseSchema>;
export type EnhancedDownloadsResponse = z.infer<typeof EnhancedDownloadsResponseSchema>;
