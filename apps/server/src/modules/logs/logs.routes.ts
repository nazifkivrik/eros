import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ErrorResponseSchema } from "@/schemas/common.schema.js";
import {
  LogSchema,
  LogsQuerySchema,
  LogParamsSchema,
  CleanupQuerySchema,
  LogsListResponseSchema,
  CleanupResponseSchema,
} from "./logs.schema.js";

/**
 * Logs Routes
 * Pure HTTP routing - delegates to controller
 * Clean Architecture: Route → Controller → Service → Repository
 */
const logsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get controller from DI container
  const { logsController } = app.container;

  // Get logs with filtering
  app.get(
    "/",
    {
      schema: {
        tags: ["logs"],
        summary: "Get application logs",
        description: "Retrieve logs with optional filtering by level, event type, and entity IDs",
        querystring: LogsQuerySchema,
        response: {
          200: LogsListResponseSchema,
        },
      },
    },
    async (request) => {
      return await logsController.list(request.query);
    }
  );

  // Get log by ID
  app.get(
    "/:id",
    {
      schema: {
        tags: ["logs"],
        summary: "Get log by ID",
        description: "Retrieve a specific log entry by its ID",
        params: LogParamsSchema,
        response: {
          200: LogSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const log = await logsController.getById(request.params);
        return log;
      } catch (error) {
        if (error instanceof Error && error.message === "Log not found") {
          return reply.code(404).send({ error: "Log not found" });
        }
        throw error;
      }
    }
  );

  // Delete old logs
  app.delete(
    "/cleanup",
    {
      schema: {
        tags: ["logs"],
        summary: "Cleanup old logs",
        description: "Delete logs older than the specified number of days",
        querystring: CleanupQuerySchema,
        response: {
          200: CleanupResponseSchema,
        },
      },
    },
    async (request) => {
      return await logsController.cleanup(request.query);
    }
  );
};

export default logsRoutes;
