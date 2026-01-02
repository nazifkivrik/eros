import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  ErrorResponseSchema,
  SuccessResponseSchema,
} from "../../schemas/common.schema.js";
import {
  DownloadQueueWithSceneSchema,
  AddToQueueSchema,
  UpdateQueueItemSchema,
  DownloadStatusSchema,
  UnifiedDownloadSchema,
} from "./download-queue.schema.js";

/**
 * Download Queue Routes
 * Pure HTTP routing - delegates to controller
 * Clean Architecture: Route → Controller → Service → Repository
 */
const downloadQueueRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get controller from DI container
  const { downloadQueueController } = app.container;

  // Get all download queue items
  app.get(
    "/",
    {
      schema: {
        tags: ["download-queue"],
        summary: "List download queue",
        description: "Get all download queue items, optionally filtered by status (queued, downloading, completed, failed, paused, seeding)",
        querystring: z.object({
          status: DownloadStatusSchema.optional().describe("Filter by download status"),
        }),
        response: {
          200: z.object({
            data: z.array(DownloadQueueWithSceneSchema),
          }),
        },
      },
    },
    async (request) => {
      return await downloadQueueController.list(request.query);
    }
  );

  // Get download queue item by ID
  app.get(
    "/:id",
    {
      schema: {
        tags: ["download-queue"],
        summary: "Get download queue item",
        description: "Retrieve detailed information about a specific download queue item including associated scene details",
        params: z.object({
          id: z.string().describe("Download queue item ID"),
        }),
        response: {
          200: DownloadQueueWithSceneSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await downloadQueueController.getById(request.params);
      } catch (error) {
        if (error instanceof Error && error.message === "Download queue item not found") {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Add to download queue
  app.post(
    "/",
    {
      schema: {
        tags: ["download-queue"],
        summary: "Add to download queue",
        description: "Add a new scene to the download queue and optionally start downloading via qBittorrent",
        body: AddToQueueSchema,
        response: {
          201: DownloadQueueWithSceneSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const created = await downloadQueueController.create(request.body);
        return reply.code(201).send(created);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "Scene not found" || error.message === "Scene already in download queue") {
            return reply.code(400).send({ error: error.message });
          }
        }
        throw error;
      }
    }
  );

  // Update download queue item
  app.patch(
    "/:id",
    {
      schema: {
        tags: ["download-queue"],
        summary: "Update download queue item",
        description: "Update status or other properties of a download queue item",
        params: z.object({
          id: z.string().describe("Download queue item ID"),
        }),
        body: UpdateQueueItemSchema,
        response: {
          200: DownloadQueueWithSceneSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await downloadQueueController.update(request.params, request.body);
      } catch (error) {
        if (error instanceof Error && error.message === "Download queue item not found") {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Remove from download queue
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["download-queue"],
        summary: "Remove from download queue",
        description: "Remove a download queue item and optionally delete the associated torrent from qBittorrent",
        params: z.object({
          id: z.string().describe("Download queue item ID"),
        }),
        querystring: z.object({
          deleteTorrent: z
            .string()
            .transform((val) => val === "true")
            .optional()
            .describe("Whether to also delete the torrent from qBittorrent"),
        }),
        response: {
          200: SuccessResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await downloadQueueController.remove(request.params, request.query);
      } catch (error) {
        if (error instanceof Error && error.message === "Download queue item not found") {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Pause download
  app.post(
    "/:id/pause",
    {
      schema: {
        tags: ["download-queue"],
        summary: "Pause download",
        description: "Pause an active download in qBittorrent and update queue status",
        params: z.object({
          id: z.string().describe("Download queue item ID"),
        }),
        response: {
          200: SuccessResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await downloadQueueController.pause(request.params);
      } catch (error) {
        if (error instanceof Error && error.message === "Download queue item not found") {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Get unified downloads (combining DB and qBittorrent data)
  app.get(
    "/unified",
    {
      schema: {
        tags: ["download-queue"],
        summary: "Get unified downloads",
        description: "Get enriched download queue with real-time torrent progress, speeds, and status from qBittorrent merged with database records",
        response: {
          200: z.object({
            downloads: z.array(UnifiedDownloadSchema),
          }),
        },
      },
    },
    async () => {
      return await downloadQueueController.getUnifiedDownloads();
    }
  );

  // Resume download
  app.post(
    "/:id/resume",
    {
      schema: {
        tags: ["download-queue"],
        summary: "Resume download",
        description: "Resume a paused download in qBittorrent and update queue status",
        params: z.object({
          id: z.string().describe("Download queue item ID"),
        }),
        response: {
          200: SuccessResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await downloadQueueController.resume(request.params);
      } catch (error) {
        if (error instanceof Error && error.message === "Download queue item not found") {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );
};

export default downloadQueueRoutes;
