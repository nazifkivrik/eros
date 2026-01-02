import { z } from "zod";

export const ResolutionSchema = z.enum(["2160p", "1080p", "720p", "480p", "any"]);
export const SourceSchema = z.enum(["bluray", "webdl", "webrip", "hdtv", "dvd", "any"]);

export const QualityItemSchema = z.object({
  quality: ResolutionSchema,
  source: SourceSchema,
  minSeeders: z.union([z.number(), z.literal("any")]),
  maxSize: z.number(), // in GB, 0 means unlimited
});

export const QualityProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  items: z.array(QualityItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Tip schema'dan üret
export type Resolution = z.infer<typeof ResolutionSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type QualityItem = z.infer<typeof QualityItemSchema>;
export type QualityProfile = z.infer<typeof QualityProfileSchema>;
