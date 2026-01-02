import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  ErrorResponseSchema,
  SuccessResponseSchema,
} from "../../schemas/common.schema.js";
import {
  PerformerResponseSchema,
  PerformerParamsSchema,
  PerformerListQuerySchema,
  CreatePerformerSchema,
  UpdatePerformerSchema,
  PerformerListResponseSchema,
} from "./performers.schema.js";

/**
 * Performers Routes
 * Pure HTTP routing - delegates to controller
 * Clean Architecture: Route → Controller → Service → Repository
 */
const performersRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get controller from DI container
  const { performersController } = app.container;

  // List performers
  app.get(
    "/",
    {
      schema: {
        tags: ["performers"],
        summary: "List performers",
        description: "Get a paginated list of performers with limit and offset",
        querystring: PerformerListQuerySchema,
        response: {
          200: PerformerListResponseSchema,
        },
      },
    },
    async (request) => {
      return await performersController.list(request.query);
    }
  );

  // Get performer by ID
  app.get(
    "/:id",
    {
      schema: {
        tags: ["performers"],
        summary: "Get performer by ID",
        description: "Retrieve detailed information about a specific performer",
        params: PerformerParamsSchema,
        response: {
          200: PerformerResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const performer = await performersController.getById(request.params);
        return performer;
      } catch (error) {
        if (error instanceof Error && error.message === "Performer not found") {
          return reply.code(404).send({ error: "Performer not found" });
        }
        throw error;
      }
    }
  );

  // Create performer
  app.post(
    "/",
    {
      schema: {
        tags: ["performers"],
        summary: "Create performer",
        description: "Add a new performer to the database",
        body: CreatePerformerSchema,
        response: {
          201: PerformerResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const created = await performersController.create(request.body);
      return reply.code(201).send(created);
    }
  );

  // Update performer
  app.patch(
    "/:id",
    {
      schema: {
        tags: ["performers"],
        summary: "Update performer",
        description: "Update information for an existing performer",
        params: PerformerParamsSchema,
        body: UpdatePerformerSchema,
        response: {
          200: PerformerResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const updated = await performersController.update(request.params, request.body);
        return updated;
      } catch (error) {
        if (error instanceof Error && error.message === "Performer not found") {
          return reply.code(404).send({ error: "Performer not found" });
        }
        throw error;
      }
    }
  );

  // Delete performer
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["performers"],
        summary: "Delete performer",
        description: "Delete a performer and optionally their associated scenes and files",
        params: PerformerParamsSchema,
        querystring: z.object({
          deleteAssociatedScenes: z.boolean().optional().default(false),
          removeFiles: z.boolean().optional().default(false),
        }),
        response: {
          200: SuccessResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        await performersController.delete(request.params, request.query);
        return { success: true };
      } catch (error) {
        if (error instanceof Error && error.message === "Performer not found") {
          return reply.code(404).send({ error: "Performer not found" });
        }
        throw error;
      }
    }
  );
};

export default performersRoutes;
