import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ErrorResponseSchema } from "../../schemas/common.schema.js";
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

/**
 * Search Routes
 * Pure HTTP routing - delegates to controller
 * Clean Architecture: Route → Controller → Service → Repository/External API
 */
const searchRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get controller from DI container
  const { searchController } = app.container;

  // Search all entities
  app.post(
    "/",
    {
      schema: {
        tags: ["search"],
        summary: "Search all entities",
        description: "Search across performers, studios, and scenes simultaneously using TPDB or StashDB metadata services",
        body: SearchQuerySchema,
        response: {
          200: SearchAllResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await searchController.searchAll(request.body);
      } catch (error) {
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
        tags: ["search"],
        summary: "Search performers",
        description: "Search for performers using configured metadata service (TPDB or StashDB)",
        body: SearchQuerySchema,
        response: {
          200: PerformersSearchResponseSchema,
        },
      },
    },
    async (request) => {
      return await searchController.searchPerformers(request.body);
    }
  );

  // Search studios only
  app.post(
    "/studios",
    {
      schema: {
        tags: ["search"],
        summary: "Search studios",
        description: "Search for studios/sites using configured metadata service (TPDB or StashDB)",
        body: SearchQuerySchema,
        response: {
          200: StudiosSearchResponseSchema,
        },
      },
    },
    async (request) => {
      return await searchController.searchStudios(request.body);
    }
  );

  // Search scenes only
  app.post(
    "/scenes",
    {
      schema: {
        tags: ["search"],
        summary: "Search scenes",
        description: "Search for scenes using configured metadata service (TPDB or StashDB)",
        body: SearchQuerySchema,
        response: {
          200: ScenesSearchResponseSchema,
        },
      },
    },
    async (request) => {
      return await searchController.searchScenes(request.body);
    }
  );

  // Get performer details
  app.get(
    "/performers/:id",
    {
      schema: {
        tags: ["search"],
        summary: "Get performer details",
        description: "Retrieve detailed information about a performer by ID (local database ID or external source:id format)",
        params: EntityIdParamsSchema,
        response: {
          200: PerformerSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await searchController.getPerformerDetails(request.params);
      } catch (error) {
        if (error instanceof Error && error.message === "Performer not found") {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Get studio details
  app.get(
    "/studios/:id",
    {
      schema: {
        tags: ["search"],
        summary: "Get studio details",
        description: "Retrieve detailed information about a studio/site by ID from configured metadata service",
        params: EntityIdParamsSchema,
        response: {
          200: StudioSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await searchController.getStudioDetails(request.params);
      } catch (error) {
        if (error instanceof Error && error.message === "Studio not found") {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Get scene details
  app.get(
    "/scenes/:id",
    {
      schema: {
        tags: ["search"],
        summary: "Get scene details",
        description: "Retrieve detailed information about a scene by ID from local database or configured metadata service, including associated files if available locally",
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
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await searchController.getSceneDetails(request.params);
      } catch (error) {
        if (error instanceof Error && error.message === "Scene not found") {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );
};

export default searchRoutes;
