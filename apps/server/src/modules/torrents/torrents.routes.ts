import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  TorrentHashParamsSchema,
  TorrentPrioritySchema,
  RemoveTorrentQuerySchema,
  TorrentListResponseSchema,
  SuccessResponseSchema,
} from "./torrents.schema.js";

const torrentsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get all torrents
  app.get(
    "/",
    {
      schema: {
        response: {
          200: TorrentListResponseSchema,
        },
      },
    },
    async () => {
      if (!app.qbittorrent) {
        return { torrents: [], total: 0 };
      }

      const torrents = await app.qbittorrent.getTorrents();
      const mapped = torrents.map((t) => app.qbittorrent!.mapTorrentInfo(t));

      return {
        torrents: mapped,
        total: mapped.length,
      };
    }
  );

  // Pause torrent
  app.post(
    "/:hash/pause",
    {
      schema: {
        params: TorrentHashParamsSchema,
        response: {
          200: SuccessResponseSchema,
          400: SuccessResponseSchema,
          404: SuccessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!app.qbittorrent) {
        return reply.code(400).send({
          success: false,
          message: "qBittorrent not configured",
        });
      }

      const { hash } = request.params;

      try {
        const success = await app.qbittorrent.pauseTorrent(hash);

        if (!success) {
          return reply.code(404).send({
            success: false,
            message: `Torrent ${hash} not found`,
          });
        }

        return {
          success: true,
          message: `Torrent ${hash} paused`,
        };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Resume torrent
  app.post(
    "/:hash/resume",
    {
      schema: {
        params: TorrentHashParamsSchema,
        response: {
          200: SuccessResponseSchema,
          400: SuccessResponseSchema,
          404: SuccessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!app.qbittorrent) {
        return reply.code(400).send({
          success: false,
          message: "qBittorrent not configured",
        });
      }

      const { hash } = request.params;

      try {
        const success = await app.qbittorrent.resumeTorrent(hash);

        if (!success) {
          return reply.code(404).send({
            success: false,
            message: `Torrent ${hash} not found`,
          });
        }

        return {
          success: true,
          message: `Torrent ${hash} resumed`,
        };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Remove torrent
  app.delete(
    "/:hash",
    {
      schema: {
        params: TorrentHashParamsSchema,
        querystring: RemoveTorrentQuerySchema,
        response: {
          200: SuccessResponseSchema,
          400: SuccessResponseSchema,
          404: SuccessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!app.qbittorrent) {
        return reply.code(400).send({
          success: false,
          message: "qBittorrent not configured",
        });
      }

      const { hash } = request.params;
      const { deleteFiles } = request.query;

      try {
        const success = await app.qbittorrent.removeTorrent(
          hash,
          deleteFiles || false
        );

        if (!success) {
          return reply.code(404).send({
            success: false,
            message: `Torrent ${hash} not found`,
          });
        }

        return {
          success: true,
          message: `Torrent ${hash} removed${deleteFiles ? " with files" : ""}`,
        };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Change torrent priority
  app.patch(
    "/:hash/priority",
    {
      schema: {
        params: TorrentHashParamsSchema,
        body: TorrentPrioritySchema,
        response: {
          200: SuccessResponseSchema,
          400: SuccessResponseSchema,
          404: SuccessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!app.qbittorrent) {
        return reply.code(400).send({
          success: false,
          message: "qBittorrent not configured",
        });
      }

      const { hash } = request.params;
      const { priority } = request.body;

      try {
        const success = await app.qbittorrent.setTorrentPriority(
          hash,
          priority
        );

        if (!success) {
          return reply.code(404).send({
            success: false,
            message: `Torrent ${hash} not found`,
          });
        }

        return {
          success: true,
          message: `Torrent ${hash} priority changed to ${priority}`,
        };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );
};

export default torrentsRoutes;
