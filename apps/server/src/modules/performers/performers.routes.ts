import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ErrorResponseSchema } from "@/schemas/common.schema.js";
import {
  PerformerResponseSchema,
  PerformerParamsSchema,
  PerformerListQuerySchema,
  CreatePerformerSchema,
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
      return reply.code(201).send(created as z.infer<typeof PerformerResponseSchema>);
    }
  );

};

export default performersRoutes;
