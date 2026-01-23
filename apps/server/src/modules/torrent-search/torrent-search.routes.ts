/**
 * Torrent Search Routes
 * HTTP endpoints for torrent search functionality
 *
 * Responsibilities:
 * - Pure HTTP routing only
 * - Get controller from DI container
 * - Delegate to controller
 * - Define Swagger schemas
 * - No business logic
 */

import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  TorrentResultArraySchema,
  ErrorResponseSchema,
} from "./torrent-search.schema.js";

/**
 * Torrent Search Routes
 */
const torrentSearchRoutes: FastifyPluginAsyncZod = async (app) => {
  const { torrentSearchController } = app.container;

  /**
   * Search torrents for an entity (performer/studio subscription)
   * POST /api/torrent-search/subscriptions/:entityType/:entityId/search
   */
  app.post(
    "/subscriptions/:entityType/:entityId/search",
    {
      schema: {
        tags: ["Torrent Search"],
        description: "Search torrents for a performer or studio subscription",
        params: z.object({
          entityType: z.enum(["performer", "studio"]),
          entityId: z.string(),
        }),
        body: z.object({
          qualityProfileId: z.string(),
          includeMetadataMissing: z.boolean().default(false),
          includeAliases: z.boolean().default(false),
          indexerIds: z.array(z.string()).default([]),
        }),
        response: {
          200: TorrentResultArraySchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      return await torrentSearchController.searchForEntity(
        request as never,
        reply
      );
    }
  );

  /**
   * Manual torrent search
   * POST /api/torrent-search/manual
   */
  app.post(
    "/manual",
    {
      schema: {
        tags: ["Torrent Search"],
        description: "Manual torrent search by query string",
        body: z.object({
          query: z.string(),
          qualityProfileId: z.string().optional(),
          limit: z.number().default(50),
        }),
        response: {
          200: TorrentResultArraySchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      return await torrentSearchController.searchManual(
        request as never,
        reply
      );
    }
  );
};

export default torrentSearchRoutes;
