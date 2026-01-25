import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { SuccessResponseSchema, ErrorResponseSchema } from "@/schemas/common.schema.js";
import {
  TorrentHashParamsSchema,
  TorrentPrioritySchema,
  RemoveTorrentQuerySchema,
  TorrentListResponseSchema,
} from "./torrents.schema.js";

/**
 * Torrents Routes
 * Pure HTTP routing - delegates to controller
 * Clean Architecture: Route → Controller → Service → External API (qBittorrent)
 */
const torrentsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get controller from DI container
  const { torrentsController } = app.container;

  // Get all torrents
  app.get(
    "/",
    {
      schema: {
        tags: ["torrents"],
        summary: "List torrents",
        description: "Get all active torrents from qBittorrent with their current status and progress",
        response: {
          200: TorrentListResponseSchema,
        },
      },
    },
    async () => {
      return await torrentsController.list();
    }
  );

  // Pause torrent
  app.post(
    "/:hash/pause",
    {
      schema: {
        tags: ["torrents"],
        summary: "Pause torrent",
        description: "Pause a torrent by its info hash",
        params: TorrentHashParamsSchema,
        response: {
          200: SuccessResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await torrentsController.pause(request.params);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "qBittorrent not configured") {
            return reply.code(400).send({ error: error.message });
          }
          if (error.message.includes("not found")) {
            return reply.code(404).send({ error: error.message });
          }
        }
        throw error;
      }
    }
  );

  // Resume torrent
  app.post(
    "/:hash/resume",
    {
      schema: {
        tags: ["torrents"],
        summary: "Resume torrent",
        description: "Resume a paused torrent by its info hash",
        params: TorrentHashParamsSchema,
        response: {
          200: SuccessResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await torrentsController.resume(request.params);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "qBittorrent not configured") {
            return reply.code(400).send({ error: error.message });
          }
          if (error.message.includes("not found")) {
            return reply.code(404).send({ error: error.message });
          }
        }
        throw error;
      }
    }
  );

  // Remove torrent
  app.delete(
    "/:hash",
    {
      schema: {
        tags: ["torrents"],
        summary: "Remove torrent",
        description: "Remove a torrent from qBittorrent, optionally deleting associated files",
        params: TorrentHashParamsSchema,
        querystring: RemoveTorrentQuerySchema,
        response: {
          200: SuccessResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await torrentsController.remove(request.params, request.query);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "qBittorrent not configured") {
            return reply.code(400).send({ error: error.message });
          }
          if (error.message.includes("not found")) {
            return reply.code(404).send({ error: error.message });
          }
        }
        throw error;
      }
    }
  );

  // Change torrent priority
  app.patch(
    "/:hash/priority",
    {
      schema: {
        tags: ["torrents"],
        summary: "Change torrent priority",
        description: "Update the download priority of a torrent (top, bottom, increase, decrease)",
        params: TorrentHashParamsSchema,
        body: TorrentPrioritySchema,
        response: {
          200: SuccessResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await torrentsController.setPriority(
          request.params,
          request.body
        );
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "qBittorrent not configured") {
            return reply.code(400).send({ error: error.message });
          }
          if (error.message.includes("not found")) {
            return reply.code(404).send({ error: error.message });
          }
        }
        throw error;
      }
    }
  );
};

export default torrentsRoutes;
