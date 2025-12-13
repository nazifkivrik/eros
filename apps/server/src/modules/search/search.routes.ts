import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { createStashDBService } from "../../services/stashdb.service.js";

const ImageSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const PerformerSchema = z.object({
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

const StudioSchema = z.object({
  id: z.string(),
  stashdbId: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  parentStudioId: z.string().nullable(),
  images: z.array(ImageSchema),
  url: z.string().nullable(),
});

const SceneSchema = z.object({
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
  performers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      disambiguation: z.string().nullable(),
    })
  ),
  studio: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
  tags: z.array(z.string()),
});

const searchRoutes: FastifyPluginAsyncZod = async (app) => {
  const stashdbService = createStashDBService({
    apiUrl: process.env.STASHDB_API_URL || "https://stashdb.org/graphql",
    apiKey: process.env.STASHDB_API_KEY,
  });

  // Search all entities
  app.post(
    "/",
    {
      schema: {
        body: z.object({
          query: z.string().min(1),
          limit: z.number().min(1).max(100).default(20),
        }),
        response: {
          200: z.object({
            performers: z.array(PerformerSchema),
            studios: z.array(StudioSchema),
            scenes: z.array(SceneSchema),
          }),
        },
      },
    },
    async (request, reply) => {
      const { query, limit } = request.body;

      try {
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
        return reply.code(500).send({
          error: error instanceof Error ? error.message : "Search failed",
        });
      }
    }
  );

  // Search performers only
  app.post(
    "/performers",
    {
      schema: {
        body: z.object({
          query: z.string().min(1),
          limit: z.number().min(1).max(100).default(20),
        }),
        response: {
          200: z.object({
            results: z.array(PerformerSchema),
          }),
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
        body: z.object({
          query: z.string().min(1),
          limit: z.number().min(1).max(100).default(20),
        }),
        response: {
          200: z.object({
            results: z.array(StudioSchema),
          }),
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
        body: z.object({
          query: z.string().min(1),
          limit: z.number().min(1).max(100).default(20),
        }),
        response: {
          200: z.object({
            results: z.array(SceneSchema),
          }),
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
        params: z.object({
          id: z.string(),
        }),
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
        params: z.object({
          id: z.string(),
        }),
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
        params: z.object({
          id: z.string(),
        }),
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
