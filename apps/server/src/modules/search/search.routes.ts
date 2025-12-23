import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
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
      const { query, limit } = request.body;

      try{
        const { service, source } = await getMetadataService();

        const [performers, studios, scenes] = await Promise.all([
          service.searchPerformers(query, limit).catch((err) => {
            app.log.error({ err, query, source }, "Failed to search performers");
            return [];
          }),
          source === 'tpdb'
            ? service.searchSites(query).then((sites: any[]) => sites.slice(0, limit)).catch((err: any) => {
                app.log.error({ err, query, source }, "Failed to search sites");
                return [];
              })
            : service.searchStudios(query, limit).catch((err: any) => {
                app.log.error({ err, query, source }, "Failed to search studios");
                return [];
              }),
          service.searchScenes(query, limit).catch((err) => {
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
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { service } = await getMetadataService();
      return await service.getPerformerById(id);
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
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { service, source } = await getMetadataService();
      return source === 'tpdb'
        ? await service.getSiteById(id)
        : await service.getStudioDetails(id);
    }
  );

  // Get scene details
  app.get(
    "/scenes/:id",
    {
      schema: {
        params: EntityIdParamsSchema,
        response: {
          200: SceneSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { service, source } = await getMetadataService();
      return source === 'tpdb'
        ? await service.getSceneById(id)
        : await service.getSceneDetails(id);
    }
  );
};

export default searchRoutes;
