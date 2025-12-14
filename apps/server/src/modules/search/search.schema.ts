import { z } from "zod";

export const ImageSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const PerformerSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  disambiguation: z.string().nullable(),
});

export const StudioSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const PerformerSchema = z.object({
  id: z.string(),
  stashdbId: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  disambiguation: z.string().nullable(),
  gender: z.string().nullable(),
  birthdate: z.string().nullable(),
  deathDate: z.string().nullable(),
  careerStartDate: z.string().nullable(),
  careerEndDate: z.string().nullable(),
  images: z.array(ImageSchema),
});

export const StudioSchema = z.object({
  id: z.string(),
  stashdbId: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  parentStudioId: z.string().nullable(),
  images: z.array(ImageSchema),
  url: z.string().nullable(),
});

export const SceneSchema = z.object({
  id: z.string(),
  stashdbId: z.string(),
  title: z.string(),
  date: z.string().nullable(),
  details: z.string().nullable(),
  duration: z.number().nullable(),
  director: z.string().nullable(),
  code: z.string().nullable(),
  urls: z.array(z.string()),
  images: z.array(ImageSchema),
  performers: z.array(PerformerSummarySchema),
  studio: StudioSummarySchema.nullable(),
  tags: z.array(z.string()),
});

export const SearchQuerySchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(100).default(20),
});

export const EntityIdParamsSchema = z.object({
  id: z.string(),
});

export const SearchAllResponseSchema = z.object({
  performers: z.array(PerformerSchema),
  studios: z.array(StudioSchema),
  scenes: z.array(SceneSchema),
});

export const PerformersSearchResponseSchema = z.object({
  results: z.array(PerformerSchema),
});

export const StudiosSearchResponseSchema = z.object({
  results: z.array(StudioSchema),
});

export const ScenesSearchResponseSchema = z.object({
  results: z.array(SceneSchema),
});
