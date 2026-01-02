import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  ErrorResponseSchema,
  SuccessResponseSchema,
} from "../../schemas/common.schema.js";
import {
  QualityProfileResponseSchema,
  QualityProfileParamsSchema,
  CreateQualityProfileSchema,
  UpdateQualityProfileSchema,
  QualityProfileListResponseSchema,
} from "./quality-profiles.schema.js";

/**
 * Quality Profiles Routes
 * Pure HTTP routing - delegates to controller
 * Clean Architecture: Route → Controller → Service → Repository
 */
const qualityProfilesRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get controller from DI container
  const { qualityProfilesController } = app.container;
  // List quality profiles
  app.get(
    "/",
    {
      schema: {
        tags: ["quality-profiles"],
        summary: "List quality profiles",
        description: "Get all quality profiles with their configured quality and source preferences",
        response: {
          200: QualityProfileListResponseSchema,
        },
      },
    },
    async () => {
      return await qualityProfilesController.list();
    }
  );

  // Get quality profile by ID
  app.get(
    "/:id",
    {
      schema: {
        tags: ["quality-profiles"],
        summary: "Get quality profile by ID",
        description: "Retrieve detailed information about a specific quality profile including its items and preferences",
        params: QualityProfileParamsSchema,
        response: {
          200: QualityProfileResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const profile = await qualityProfilesController.getById(request.params);
        return profile;
      } catch (error) {
        if (error instanceof Error && error.message === "Quality profile not found") {
          return reply.code(404).send({ error: "Quality profile not found" });
        }
        throw error;
      }
    }
  );

  // Create quality profile
  app.post(
    "/",
    {
      schema: {
        tags: ["quality-profiles"],
        summary: "Create quality profile",
        description: "Add a new quality profile with quality and source preferences. Items are automatically sorted from best to worst quality",
        body: CreateQualityProfileSchema,
        response: {
          201: QualityProfileResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const profile = await qualityProfilesController.create(request.body);
      return reply.code(201).send(profile);
    }
  );

  // Update quality profile
  app.put(
    "/:id",
    {
      schema: {
        tags: ["quality-profiles"],
        summary: "Update quality profile",
        description: "Update an existing quality profile's name or items. Items are automatically sorted from best to worst quality",
        params: QualityProfileParamsSchema,
        body: UpdateQualityProfileSchema,
        response: {
          200: QualityProfileResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const updated = await qualityProfilesController.update(request.params, request.body);
        return updated;
      } catch (error) {
        if (error instanceof Error && error.message === "Quality profile not found") {
          return reply.code(404).send({ error: "Quality profile not found" });
        }
        throw error;
      }
    }
  );

  // Delete quality profile
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["quality-profiles"],
        summary: "Delete quality profile",
        description: "Delete a quality profile by ID. This will affect any subscriptions using this profile",
        params: QualityProfileParamsSchema,
        response: {
          200: SuccessResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await qualityProfilesController.delete(request.params);
      } catch (error) {
        if (error instanceof Error && error.message === "Quality profile not found") {
          return reply.code(404).send({ error: "Quality profile not found" });
        }
        throw error;
      }
    }
  );
};

export default qualityProfilesRoutes;
