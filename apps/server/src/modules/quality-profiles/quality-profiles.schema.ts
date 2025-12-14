import { z } from "zod";

export const QualityItemSchema = z.object({
  quality: z.enum([
    "2160p",
    "1080p",
    "720p",
    "480p",
    "any", // any quality
  ]),
  source: z.enum([
    "bluray",
    "webdl",
    "webrip",
    "hdtv",
    "dvd",
    "any", // any source
  ]),
  minSeeders: z.union([z.number().min(0), z.literal("any")]).default(0), // can be "any" or a number
  maxSize: z.number().min(0).default(0), // in GB, 0 means unlimited
});

export const QualityProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  items: z.array(QualityItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const QualityProfileParamsSchema = z.object({
  id: z.string(),
});

export const CreateQualityProfileSchema = z.object({
  name: z.string().min(1),
  items: z.array(QualityItemSchema).min(1),
});

export const UpdateQualityProfileSchema = z.object({
  name: z.string().min(1),
  items: z.array(QualityItemSchema).min(1),
});

export const QualityProfileListResponseSchema = z.object({
  data: z.array(QualityProfileResponseSchema),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});
