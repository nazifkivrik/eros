import { z } from "zod";

export const ImageSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const PerformerResponseSchema = z.object({
  id: z.string(),
  stashdbId: z.string().nullable(),
  name: z.string(),
  aliases: z.array(z.string()),
  disambiguation: z.string().nullable(),
  gender: z.string().nullable(),
  birthdate: z.string().nullable(),
  deathDate: z.string().nullable(),
  careerStartDate: z.string().nullable(),
  careerEndDate: z.string().nullable(),
  images: z.array(ImageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PerformerParamsSchema = z.object({
  id: z.string(),
});

export const PerformerListQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const CreatePerformerSchema = z.object({
  stashdbId: z.string().optional(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  disambiguation: z.string().optional(),
  gender: z.string().optional(),
  birthdate: z.string().optional(),
  deathDate: z.string().optional(),
  careerStartDate: z.string().optional(),
  careerEndDate: z.string().optional(),
  images: z.array(ImageSchema).default([]),
});

export const UpdatePerformerSchema = z.object({
  name: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  disambiguation: z.string().optional(),
  gender: z.string().optional(),
  birthdate: z.string().optional(),
  deathDate: z.string().optional(),
  careerStartDate: z.string().optional(),
  careerEndDate: z.string().optional(),
  images: z.array(ImageSchema).optional(),
});

export const PerformerListResponseSchema = z.object({
  data: z.array(PerformerResponseSchema),
  total: z.number(),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});
