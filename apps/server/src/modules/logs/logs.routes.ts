import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { createLogsService } from "../../services/logs.service.js";

const LogSchema = z.object({
  id: z.string(),
  level: z.enum(["error", "warning", "info", "debug"]),
  eventType: z.enum(["torrent", "subscription", "download", "metadata", "system"]),
  message: z.string(),
  details: z.record(z.unknown()).nullable(),
  sceneId: z.string().nullable(),
  performerId: z.string().nullable(),
  studioId: z.string().nullable(),
  createdAt: z.string(),
});

const logsRoutes: FastifyPluginAsyncZod = async (app) => {
  const logsService = createLogsService(app.db);

  // Get logs with filtering
  app.get(
    "/",
    {
      schema: {
        querystring: z
          .object({
            level: z.enum(["error", "warning", "info", "debug"]).optional(),
            eventType: z.enum(["torrent", "subscription", "download", "metadata", "system"]).optional(),
            sceneId: z.string().optional(),
            performerId: z.string().optional(),
            studioId: z.string().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            limit: z.coerce.number().optional().default(100),
            offset: z.coerce.number().optional().default(0),
          })
          .transform((data) => {
            // Remove undefined/empty string values from optional fields
            const cleaned: any = {};
            for (const [key, value] of Object.entries(data)) {
              if (value !== undefined && value !== "" && value !== "undefined") {
                cleaned[key] = value;
              }
            }
            // Preserve default values
            if (!cleaned.limit) cleaned.limit = 100;
            if (!cleaned.offset) cleaned.offset = 0;
            return cleaned;
          }),
        response: {
          200: z.object({
            data: z.array(LogSchema),
            total: z.number(),
          }),
        },
      },
    },
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
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: LogSchema,
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
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
        querystring: z.object({
          daysToKeep: z.coerce.number().optional().default(30),
        }),
        response: {
          200: z.object({
            deletedCount: z.number(),
          }),
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
