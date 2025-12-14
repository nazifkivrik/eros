import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { createLogsService } from "../../services/logs.service.js";
import {
  LogSchema,
  LogsQuerySchema,
  LogParamsSchema,
  CleanupQuerySchema,
  LogsListResponseSchema,
  CleanupResponseSchema,
  ErrorResponseSchema,
} from "./logs.schema.js";

const logsRoutes: FastifyPluginAsyncZod = async (app) => {
  const logsService = createLogsService(app.db);

  // Get logs with filtering
  app.get(
    "/",
    {
      schema: {
        querystring: LogsQuerySchema,
        response: {
          200: LogsListResponseSchema,
        },
      },
    },
    // @ts-expect-error - Fastify type provider has issues with ZodEffects transform
    async (request) => {
      const filters = request.query as any;
      const result = await logsService.getLogs(filters);
      return result;
    }
  );

  // Get log by ID
  app.get(
    "/:id",
    {
      schema: {
        params: LogParamsSchema,
        response: {
          200: LogSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    // @ts-expect-error - Fastify type provider entityType inference issue
    async (request, reply) => {
      const { id } = request.params;
      const log = await logsService.getLog(id);

      if (!log) {
        return reply.code(404).send({ error: "Log not found" });
      }

      return log;
    }
  );

  // Delete old logs
  app.delete(
    "/cleanup",
    {
      schema: {
        querystring: CleanupQuerySchema,
        response: {
          200: CleanupResponseSchema,
        },
      },
    },
    async (request) => {
      const { daysToKeep } = request.query as any;
      const deletedCount = await logsService.deleteOldLogs(daysToKeep);
      return { deletedCount };
    }
  );
};

export default logsRoutes;
