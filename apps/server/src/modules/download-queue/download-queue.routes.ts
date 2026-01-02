import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { downloadQueue, scenes } from "@repo/database";
import { nanoid } from "nanoid";
import type { DownloadStatus } from "@repo/shared-types";
import {
  DownloadQueueWithSceneSchema,
  AddToQueueSchema,
  UpdateQueueItemSchema,
  DownloadStatusSchema,
  UnifiedDownloadSchema,
} from "./download-queue.schema.js";

const downloadQueueRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get all download queue items
  app.get(
    "/",
    {
      schema: {
        querystring: z.object({
          status: DownloadStatusSchema.optional(),
        }),
        response: {
          200: z.object({
            data: z.array(DownloadQueueWithSceneSchema),
          }),
        },
      },
    },
    async (request) => {
      const { status } = request.query;

      const items = await app.db.query.downloadQueue.findMany({
        where: status ? eq(downloadQueue.status, status) : undefined,
        with: {
          scene: {
            columns: {
              id: true,
              title: true,
              externalIds: true,
              images: true,
            },
          },
        },
        orderBy: (downloadQueue, { desc }) => [desc(downloadQueue.addedAt)],
      });

      return {
        data: items.map((item) => ({
          ...item,
          status: item.status as DownloadStatus,
        })),
      };
    }
  );

  // Get download queue item by ID
  app.get(
    "/:id",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: DownloadQueueWithSceneSchema,
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const item = await app.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.id, id),
        with: {
          scene: {
            columns: {
              id: true,
              title: true,
              externalIds: true,
              images: true,
            },
          },
        },
      });

      if (!item) {
        return reply.code(404).send({ error: "Download queue item not found" });
      }

      return {
        ...item,
        status: item.status as DownloadStatus,
      };
    }
  );

  // Add to download queue
  app.post(
    "/",
    {
      schema: {
        body: AddToQueueSchema,
        response: {
          201: DownloadQueueWithSceneSchema,
          400: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { sceneId, title, size, seeders, quality, magnetLink } =
        request.body;

      // Check if scene exists
      const scene = await app.db.query.scenes.findFirst({
        where: eq(scenes.id, sceneId),
      });

      if (!scene) {
        return reply.code(400).send({ error: "Scene not found" });
      }

      // Check if already in queue
      const existing = await app.db.query.downloadQueue.findFirst({
        where: and(
          eq(downloadQueue.sceneId, sceneId),
          eq(downloadQueue.status, "queued")
        ),
      });

      if (existing) {
        return reply
          .code(400)
          .send({ error: "Scene already in download queue" });
      }

      const id = nanoid();
      const now = new Date().toISOString();

      const newItem = {
        id,
        sceneId,
        torrentHash: null,
        title,
        size,
        seeders,
        quality,
        status: "queued" as const,
        addedAt: now,
        completedAt: null,
      };

      await app.db.insert(downloadQueue).values(newItem);

      // If magnetLink provided, add to qBittorrent
      if (magnetLink && app.qbittorrent) {
        try {
          await app.qbittorrent.addTorrent({
            magnetLinks: [magnetLink],
            category: "eros",
            paused: false,
          });

          app.log.info({ sceneId, title }, "Added torrent to qBittorrent");
        } catch (error) {
          app.log.error(
            { error, sceneId, title },
            "Failed to add torrent to qBittorrent"
          );
        }
      }

      // Fetch with scene info
      const created = await app.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.id, id),
        with: {
          scene: {
            columns: {
              id: true,
              title: true,
              externalIds: true,
              images: true,
            },
          },
        },
      });

      return reply.code(201).send({
        ...created!,
        status: created!.status as DownloadStatus,
      });
    }
  );

  // Update download queue item
  app.patch(
    "/:id",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        body: UpdateQueueItemSchema,
        response: {
          200: DownloadQueueWithSceneSchema,
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const existing = await app.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.id, id),
      });

      if (!existing) {
        return reply.code(404).send({ error: "Download queue item not found" });
      }

      await app.db
        .update(downloadQueue)
        .set(updates)
        .where(eq(downloadQueue.id, id));

      const updated = await app.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.id, id),
        with: {
          scene: {
            columns: {
              id: true,
              title: true,
              externalIds: true,
              images: true,
            },
          },
        },
      });

      return {
        ...updated!,
        status: updated!.status as DownloadStatus,
      };
    }
  );

  // Remove from download queue
  app.delete(
    "/:id",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        querystring: z.object({
          deleteTorrent: z
            .string()
            .transform((val) => val === "true")
            .optional(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
          }),
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { deleteTorrent = false } = request.query;

      const item = await app.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.id, id),
      });

      if (!item) {
        return reply.code(404).send({ error: "Download queue item not found" });
      }

      // Remove from qBittorrent if torrent hash exists
      if (item.torrentHash && deleteTorrent && app.qbittorrent) {
        try {
          await app.qbittorrent.removeTorrent(item.torrentHash, deleteTorrent);
          app.log.info(
            { torrentHash: item.torrentHash },
            "Removed torrent from qBittorrent"
          );
        } catch (error) {
          app.log.error(
            { error, torrentHash: item.torrentHash },
            "Failed to remove torrent from qBittorrent"
          );
        }
      }

      await app.db.delete(downloadQueue).where(eq(downloadQueue.id, id));

      return { success: true };
    }
  );

  // Pause download
  app.post(
    "/:id/pause",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
          }),
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const item = await app.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.id, id),
      });

      if (!item) {
        return reply.code(404).send({ error: "Download queue item not found" });
      }

      if (item.torrentHash && app.qbittorrent) {
        try {
          await app.qbittorrent.pauseTorrent(item.torrentHash);
        } catch (error) {
          app.log.error({ error }, "Failed to pause torrent");
        }
      }

      await app.db
        .update(downloadQueue)
        .set({ status: "paused" })
        .where(eq(downloadQueue.id, id));

      return { success: true };
    }
  );

  // Get unified downloads (combining DB and qBittorrent data)
  app.get(
    "/unified",
    {
      schema: {
        response: {
          200: z.object({
            downloads: z.array(UnifiedDownloadSchema),
          }),
        },
      },
    },
    async () => {
      // Get all download queue items
      const queueItems = await app.db.query.downloadQueue.findMany({
        with: {
          scene: {
            columns: {
              id: true,
              title: true,
              images: true,
            },
            with: {
              site: {
                columns: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: (downloadQueue, { desc }) => [desc(downloadQueue.addedAt)],
      });

      // Get torrents from qBittorrent if available
      let torrentsMap = new Map<string, unknown>();
      if (app.qbittorrent) {
        try {
          const torrents = await app.qbittorrent.getTorrents();
          torrentsMap = new Map(torrents.map((t) => [t.hash, t]));
        } catch (error: unknown) {
          app.log.error({ error }, "Failed to fetch torrents from qBittorrent");
        }
      }

      // Merge data from DB and qBittorrent
      const unifiedDownloads = queueItems.map((item) => {
        const torrent = item.qbitHash ? (torrentsMap.get(item.qbitHash) as Record<string, unknown> | undefined) : null;
        const scene = item.scene;
        const studio = scene?.site;

        // Determine unified status
        let status: DownloadStatus = item.status as DownloadStatus;
        if (torrent) {
          const torrentState = torrent.state as string | undefined;
          const torrentProgress = torrent.progress as number | undefined;

          if (torrentState === "pausedDL") {
            status = "paused";
          } else if (torrentState?.includes("DL") || torrentState === "metaDL") {
            status = "downloading";
          } else if (torrentState?.includes("UP") || torrentState === "uploading") {
            status = "seeding";
          } else if (torrentProgress !== undefined && torrentProgress >= 1.0) {
            status = "completed";
          }
        }

        return {
          id: item.id,
          sceneId: item.sceneId,
          sceneTitle: scene?.title || item.title,
          scenePoster: scene?.images?.[0]?.url || null,
          sceneStudio: studio?.name || null,
          qbitHash: item.qbitHash,
          status,
          progress: torrent ? (torrent.progress as number | undefined) ?? null : (item.status === "completed" ? 1 : null),
          downloadSpeed: torrent ? (torrent.dlspeed as number | undefined) ?? null : null,
          uploadSpeed: torrent ? (torrent.upspeed as number | undefined) ?? null : null,
          eta: torrent ? (torrent.eta as number | undefined) ?? null : null,
          ratio: torrent ? (torrent.ratio as number | undefined) ?? null : null,
          size: item.size,
          seeders: (torrent?.num_seeds as number | undefined) || item.seeders,
          leechers: (torrent?.num_leechs as number | undefined) || 0,
          quality: item.quality,
          priority: (torrent?.priority as number | undefined) || null,
          addedAt: item.addedAt,
          completedAt: item.completedAt,
        };
      });

      return { downloads: unifiedDownloads };
    }
  );

  // Resume download
  app.post(
    "/:id/resume",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
          }),
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const item = await app.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.id, id),
      });

      if (!item) {
        return reply.code(404).send({ error: "Download queue item not found" });
      }

      if (item.torrentHash && app.qbittorrent) {
        try {
          await app.qbittorrent.resumeTorrent(item.torrentHash);
        } catch (error) {
          app.log.error({ error }, "Failed to resume torrent");
        }
      }

      await app.db
        .update(downloadQueue)
        .set({ status: "downloading" })
        .where(eq(downloadQueue.id, id));

      return { success: true };
    }
  );
};

export default downloadQueueRoutes;
