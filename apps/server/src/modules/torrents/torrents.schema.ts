import { z } from "zod";

export const TorrentHashParamsSchema = z.object({
  hash: z.string().min(1),
});

export const TorrentPrioritySchema = z.object({
  priority: z.enum(["increase", "decrease", "top", "bottom"]),
});

export const RemoveTorrentQuerySchema = z.object({
  deleteFiles: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

export const TorrentInfoSchema = z.object({
  hash: z.string(),
  name: z.string(),
  size: z.number(),
  progress: z.number(),
  downloadSpeed: z.number(),
  uploadSpeed: z.number(),
  eta: z.number(),
  ratio: z.number(),
  state: z.string(),
  category: z.string(),
  savePath: z.string(),
  addedOn: z.number(),
  completionOn: z.number(),
  seeders: z.number(),
  leechers: z.number(),
});

export const TorrentListResponseSchema = z.object({
  torrents: z.array(TorrentInfoSchema),
  total: z.number(),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
