/**
 * Zod Schemas for Torrent Search API
 */

import { z } from "zod";

/**
 * Torrent Result Schema
 */
export const TorrentResultSchema = z.object({
  title: z.string(),
  size: z.number(),
  seeders: z.number(),
  leechers: z.number().optional(),
  quality: z.string(),
  source: z.string(),
  indexerId: z.string(),
  indexerName: z.string(),
  downloadUrl: z.string(),
  infoHash: z.string(),
  sceneId: z.string().optional(),
  indexers: z.array(z.string()).optional(),
  indexerCount: z.number().optional(),
});

/**
 * Search by Entity Request Schema
 */
export const SearchByEntityRequestSchema = z.object({
  entityType: z.enum(["performer", "studio"]),
  entityId: z.string(),
  qualityProfileId: z.string(),
  includeMetadataMissing: z.boolean().default(false),
  includeAliases: z.boolean().default(false),
  indexerIds: z.array(z.string()).default([]),
});

/**
 * Manual Search Request Schema
 */
export const ManualSearchRequestSchema = z.object({
  query: z.string(),
  qualityProfileId: z.string().optional(),
  limit: z.number().default(50).optional(),
});

/**
 * Response Schemas
 */
export const TorrentResultArraySchema = z.array(TorrentResultSchema);

/**
 * Error Response Schema
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
});

/**
 * Type exports
 */
export type TorrentResult = z.infer<typeof TorrentResultSchema>;
export type SearchByEntityRequest = z.infer<typeof SearchByEntityRequestSchema>;
export type ManualSearchRequest = z.infer<typeof ManualSearchRequestSchema>;
