import { z } from "zod";
import {
  DownloadStatusSchema,
  DownloadQueueItemResponseSchema,
  EnhancedDownloadsResponseSchema,
} from "@repo/shared-types";

export { DownloadStatusSchema } from "@repo/shared-types";

export const DownloadQueueItemSchema = DownloadQueueItemResponseSchema;
export const DownloadQueueWithSceneSchema = DownloadQueueItemResponseSchema;

export const AddToQueueSchema = z.object({
  sceneId: z.string(),
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

// Re-export unified download schema from shared types
export const UnifiedDownloadStatusSchema = DownloadStatusSchema;
export const UnifiedDownloadSchema = EnhancedDownloadsResponseSchema.shape.downloads.element;
