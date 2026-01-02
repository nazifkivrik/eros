import { z } from "zod";
import { IdParamsSchema } from "../../schemas/common.schema.js";

export const ImageSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const PerformerResponseSchema = z.object({
  id: z.string(),
  tpdbId: z.string().nullable(),
  slug: z.string(),
  name: z.string(),
  fullName: z.string(),
  rating: z.number(),
  aliases: z.array(z.string()),
  disambiguation: z.string().nullable(),
  bio: z.string().nullable(),
  gender: z.string().nullable(),
  birthdate: z.string().nullable(),
  deathDate: z.string().nullable(),
  careerStartYear: z.number().nullable(),
  careerEndYear: z.number().nullable(),
  fakeBoobs: z.boolean(),
  sameSexOnly: z.boolean(),
  images: z.array(ImageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PerformerParamsSchema = IdParamsSchema;

export const PerformerListQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const CreatePerformerSchema = z.object({
  tpdbId: z.string().optional(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  disambiguation: z.string().optional(),
  gender: z.string().optional(),
  birthdate: z.string().optional(),
  deathDate: z.string().optional(),
  images: z.array(ImageSchema).default([]),
});

export const UpdatePerformerSchema = z.object({
  name: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  disambiguation: z.string().optional(),
  gender: z.string().optional(),
  birthdate: z.string().optional(),
  deathDate: z.string().optional(),
  images: z.array(ImageSchema).optional(),
});

export const PerformerListResponseSchema = z.object({
  data: z.array(PerformerResponseSchema),
  total: z.number(),
});
