import { z } from "zod";

export const DownloadStatusSchema = z.enum([
  "queued",
  "downloading",
  "completed",
  "failed",
  "paused",
]);

export const DownloadQueueItemSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  torrentHash: z.string().nullable(),
  indexerId: z.string(),
  title: z.string(),
  size: z.number(),
  seeders: z.number(),
  quality: z.string(),
  status: DownloadStatusSchema,
  addedAt: z.string(),
  completedAt: z.string().nullable(),
});

export const SceneInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  stashdbId: z.string().nullable(),
  images: z.array(
    z.object({
      url: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
  ),
});

export const DownloadQueueWithSceneSchema = DownloadQueueItemSchema.extend({
  scene: SceneInfoSchema.nullable(),
});

export const AddToQueueSchema = z.object({
  sceneId: z.string(),
  indexerId: z.string(),
  title: z.string(),
  size: z.number().positive(),
  seeders: z.number().min(0),
  quality: z.string(),
  magnetLink: z.string().optional(),
});

export const UpdateQueueItemSchema = z.object({
  status: DownloadStatusSchema.optional(),
  torrentHash: z.string().optional(),
  completedAt: z.string().optional(),
});

export const QueueFilterSchema = z.object({
  status: DownloadStatusSchema.optional(),
  sceneId: z.string().optional(),
});

// Unified download status (includes seeding state from qBittorrent)
export const UnifiedDownloadStatusSchema = z.enum([
  "queued",
  "downloading",
  "completed",
  "seeding",
  "paused",
  "failed",
]);

// Unified download schema combining DB and qBittorrent data
export const UnifiedDownloadSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  sceneTitle: z.string(),
  scenePoster: z.string().nullable(),
  sceneStudio: z.string().nullable(),
  qbitHash: z.string().nullable(),
  status: UnifiedDownloadStatusSchema,
  progress: z.number().min(0).max(1), // 0-1
  downloadSpeed: z.number().min(0), // bytes/sec
  uploadSpeed: z.number().min(0), // bytes/sec
  eta: z.number().min(0), // seconds
  size: z.number(),
  seeders: z.number().min(0),
  leechers: z.number().min(0),
  quality: z.string(),
  priority: z.number().nullable(), // qBittorrent priority
  addedAt: z.string(),
  completedAt: z.string().nullable(),
});
