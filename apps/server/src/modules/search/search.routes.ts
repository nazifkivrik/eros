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
  // Use the StashDB service from the app instance (configured via plugin)
  const stashdbService = app.stashdb;

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
        const [performers, studios, scenes] = await Promise.all([
          stashdbService.searchPerformers(query, limit).catch((err) => {
            app.log.error({ err, query }, "Failed to search performers");
            return [];
          }),
          stashdbService.searchStudios(query, limit).catch((err) => {
            app.log.error({ err, query }, "Failed to search studios");
            return [];
          }),
          stashdbService.searchScenes(query, limit).catch((err) => {
            app.log.error({ err, query }, "Failed to search scenes");
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
      const results = await stashdbService.searchPerformers(query, limit);
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
      const results = await stashdbService.searchStudios(query, limit);
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
      const results = await stashdbService.searchScenes(query, limit);
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
      return await stashdbService.getPerformerDetails(id);
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
      return await stashdbService.getStudioDetails(id);
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
      return await stashdbService.getSceneDetails(id);
    }
  );
};

export default searchRoutes;
