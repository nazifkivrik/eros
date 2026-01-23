import { z } from "zod";

/**
 * Ortak entity schema'ları
 * Server ve frontend'de kullanılır
 */

export const ImageSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});

// Performer Schema
export const PerformerSchema = z.object({
  id: z.string(),
  externalIds: z.array(z.object({ source: z.string(), id: z.string() })),
  slug: z.string(),
  name: z.string(),
  fullName: z.string(),
  disambiguation: z.string().nullable(),
  bio: z.string().nullable(),
  rating: z.number(),
  aliases: z.array(z.string()),

  // Physical attributes
  gender: z.string().nullable(),
  birthdate: z.string().nullable(),
  deathDate: z.string().nullable(),
  birthplace: z.string().nullable(),
  birthplaceCode: z.string().nullable(),
  astrology: z.string().nullable(),
  ethnicity: z.string().nullable(),
  nationality: z.string().nullable(),

  // Appearance
  hairColour: z.string().nullable(),
  eyeColour: z.string().nullable(),
  height: z.string().nullable(),
  weight: z.string().nullable(),
  measurements: z.string().nullable(),
  cupsize: z.string().nullable(),
  waist: z.string().nullable(),
  hips: z.string().nullable(),
  tattoos: z.string().nullable(),
  piercings: z.string().nullable(),
  fakeBoobs: z.boolean(),

  // Career
  careerStartYear: z.number().nullable(),
  careerEndYear: z.number().nullable(),
  sameSexOnly: z.boolean(),

  // Media
  images: z.array(ImageSchema),
  thumbnail: z.string().nullable(),
  poster: z.string().nullable(),

  // External links
  links: z.union([
    z.array(z.object({ url: z.string(), platform: z.string() })),
    z.record(z.string().nullable())
  ]).nullable(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// Studio Schema
export const StudioSchema = z.object({
  id: z.string(),
  externalIds: z.array(z.object({ source: z.string(), id: z.string() })),
  name: z.string(),
  shortName: z.string().nullable(),
  slug: z.string().nullable(),
  url: z.string().nullable(),
  description: z.string().nullable(),
  rating: z.number(),

  // Hierarchy
  parentStudioId: z.string().nullish(),
  networkId: z.string().nullish(),

  // Media
  images: z.array(ImageSchema),
  logo: z.string().nullish(),
  favicon: z.string().nullish(),
  poster: z.string().nullish(),

  // External links
  links: z.union([
    z.array(z.object({ url: z.string(), platform: z.string() })),
    z.record(z.string().nullable())
  ]).nullable(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// Scene Schema
export const SceneSchema = z.object({
  id: z.string(),
  externalIds: z.array(z.object({ source: z.string(), id: z.string() })),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  date: z.string().nullable(),

  // Content type
  contentType: z.enum(["scene", "jav", "movie"]),

  // Media info
  duration: z.number().nullable(),
  format: z.string().nullable(),

  // Identifiers
  externalId: z.string().nullable(),
  code: z.string().nullable(),
  sku: z.string().nullable(),
  url: z.string().nullable(),

  // Media
  images: z.array(ImageSchema),
  poster: z.string().nullable(),
  backImage: z.string().nullable(),
  thumbnail: z.string().nullable(),
  trailer: z.string().nullable(),
  background: z.object({
    full: z.string().nullable(),
    large: z.string().nullable(),
    medium: z.string().nullable(),
    small: z.string().nullable(),
  }).nullable(),

  // Metadata
  rating: z.number(),

  // Relations
  siteId: z.string().nullable(),
  directorIds: z.array(z.string()).default([]),

  // External links
  links: z.union([
    z.array(z.object({ url: z.string(), platform: z.string() })),
    z.record(z.string().nullable())
  ]).nullable(),

  // System
  hasMetadata: z.boolean(),
  inferredFromIndexers: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// Search schemas
export const SearchQuerySchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(100).default(20),
  page: z.number().min(1).default(1),
});

export const EntityIdParamsSchema = z.object({
  id: z.string(),
});

// Response schemas
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

// Tipler schema'dan üret
export type Image = z.infer<typeof ImageSchema>;
export type Performer = z.infer<typeof PerformerSchema>;
export type Studio = z.infer<typeof StudioSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchAllResponse = z.infer<typeof SearchAllResponseSchema>;
export type PerformersSearchResponse = z.infer<typeof PerformersSearchResponseSchema>;
export type StudiosSearchResponse = z.infer<typeof StudiosSearchResponseSchema>;
export type ScenesSearchResponse = z.infer<typeof ScenesSearchResponseSchema>;
