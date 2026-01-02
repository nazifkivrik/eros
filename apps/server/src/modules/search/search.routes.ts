import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { performers, studios, scenes } from "@repo/database/schema";
import { createStashDBService } from "../../services/stashdb.service.js";
import {
  PerformerSchema,
  StudioSchema,
  SceneSchema,
  SearchQuerySchema,
  EntityIdParamsSchema,
  SearchAllResponseSchema,
  PerformersSearchResponseSchema,
  StudiosSearchResponseSchema,
  ScenesSearchResponseSchema,
} from "./search.schema.js";

const searchRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get settings to determine primary metadata source
  const getMetadataService = async () => {
    const { createSettingsService } = await import("../../services/settings.service.js");
    const settingsService = createSettingsService(app.db);
    const settings = await settingsService.getSettings();

    // Use TPDB if enabled and configured, otherwise fall back to StashDB
    if (settings.tpdb?.enabled && settings.tpdb?.apiKey && app.tpdb) {
      return { service: app.tpdb, source: 'tpdb' as const };
    }

    if (settings.stashdb?.enabled && app.stashdb) {
      return { service: app.stashdb, source: 'stashdb' as const };
    }

    throw new Error("No metadata service configured");
  };

  // Search all entities
  app.post(
    "/",
    {
      schema: {
        body: SearchQuerySchema,
        response: {
          200: SearchAllResponseSchema,
        },
      },
    },
    async (request) => {
      const { query, limit, page } = request.body;

      try{
        const { service, source } = await getMetadataService();

        const [performers, studios, scenes] = await Promise.all([
          service.searchPerformers(query, limit, page).catch((err) => {
            app.log.error({ err, query, source }, "Failed to search performers");
            return [];
          }),
          source === 'tpdb'
            ? service.searchSites(query, page).then((sites: any[]) => sites.slice(0, limit)).catch((err: any) => {
                app.log.error({ err, query, source }, "Failed to search sites");
                return [];
              })
            : service.searchStudios(query, limit, page).catch((err: any) => {
                app.log.error({ err, query, source }, "Failed to search studios");
                return [];
              }),
          service.searchScenes(query, limit, page).catch((err) => {
            app.log.error({ err, query, source }, "Failed to search scenes");
            return [];
          }),
        ]);

        return {
          performers,
          studios,
          scenes,
        };
      } catch (error) {
        app.log.error({ error, query }, "Search failed");
        throw app.httpErrors.internalServerError(
          error instanceof Error ? error.message : "Search failed"
        );
      }
    }
  );

  // Search performers only
  app.post(
    "/performers",
    {
      schema: {
        body: SearchQuerySchema,
        response: {
          200: PerformersSearchResponseSchema,
        },
      },
    },
    async (request) => {
      const { query, limit } = request.body;
      const { service } = await getMetadataService();
      const results = await service.searchPerformers(query, limit);
      return { results };
    }
  );

  // Search studios only
  app.post(
    "/studios",
    {
      schema: {
        body: SearchQuerySchema,
        response: {
          200: StudiosSearchResponseSchema,
        },
      },
    },
    async (request) => {
      const { query, limit } = request.body;
      const { service, source } = await getMetadataService();
      const results = source === 'tpdb'
        ? await service.searchSites(query).then((sites: any[]) => sites.slice(0, limit))
        : await service.searchStudios(query, limit);
      return { results };
    }
  );

  // Search scenes only
  app.post(
    "/scenes",
    {
      schema: {
        body: SearchQuerySchema,
        response: {
          200: ScenesSearchResponseSchema,
        },
      },
    },
    async (request) => {
      const { query, limit } = request.body;
      const { service } = await getMetadataService();
      const results = await service.searchScenes(query, limit);
      return { results };
    }
  );

  // Get performer details
  app.get(
    "/performers/:id",
    {
      schema: {
        params: EntityIdParamsSchema,
        response: {
          200: PerformerSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // First check if this is a local DB ID
      const performer = await app.db.query.performers.findFirst({
        where: eq(performers.id, id),
      });

      if (performer) {
        return performer;
      }

      // If not found locally, try to fetch from external source
      // ID format: source:externalId (e.g., "tpdb:12345")
      const [source, externalId] = id.includes(':') ? id.split(':') : ['tpdb', id];

      // UUID format validation for TPDB (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(externalId);

      if (!isValidUUID) {
        app.log.warn({ id, externalId }, "Invalid UUID format for TPDB lookup");
        return reply.code(404).send({ error: 'Performer not found' });
      }

      try {
        const { service } = await getMetadataService();
        if (source === 'tpdb' && app.tpdb) {
          return await app.tpdb.getPerformerById(externalId);
        }
      } catch (error) {
        app.log.error({ error, id, externalId }, "Failed to fetch performer from TPDB");
        return reply.code(404).send({ error: 'Performer not found' });
      }

      return reply.code(404).send({ error: 'Performer not found' });
    }
  );

  // Get studio details
  app.get(
    "/studios/:id",
    {
      schema: {
        params: EntityIdParamsSchema,
        response: {
          200: StudioSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        const { service, source } = await getMetadataService();
        const studio = source === 'tpdb'
          ? await service.getSiteById(id)
          : await service.getStudioDetails(id);

        if (!studio) {
          return reply.code(404).send({ error: 'Studio not found' });
        }

        return studio;
      } catch (error) {
        app.log.error({ error, id }, "Failed to fetch studio details");
        return reply.code(404).send({ error: 'Studio not found' });
      }
    }
  );

  // Get scene details
  app.get(
    "/scenes/:id",
    {
      schema: {
        params: EntityIdParamsSchema,
        response: {
          200: SceneSchema.extend({
            files: z.array(z.object({
              id: z.string(),
              filePath: z.string(),
              fileSize: z.number(),
              createdAt: z.string(),
            })).optional(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        // First, check local database for this scene
        const localScene = await app.db.query.scenes.findFirst({
          where: eq(scenes.id, id),
          with: {
            sceneFiles: true,
          },
        });

        // If scene exists locally, return it with file information
        if (localScene) {
          return {
            ...localScene,
            files: localScene.sceneFiles || [],
          };
        }

        // If not found locally, fetch from metadata service
        const { service, source } = await getMetadataService();
        const scene = source === 'tpdb'
          ? await service.getSceneById(id)
          : await service.getSceneDetails(id);

        if (!scene) {
          return reply.code(404).send({ error: 'Scene not found' });
        }

        return scene;
      } catch (error) {
        app.log.error({ error, id }, "Failed to fetch scene details");
        return reply.code(404).send({ error: 'Scene not found' });
      }
    }
  );
};

export default searchRoutes;
