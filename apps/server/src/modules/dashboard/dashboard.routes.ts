import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  const { dashboardController } = app.container;

  app.get(
    "/statistics",
    {
      schema: {
        tags: ["dashboard"],
        summary: "Get dashboard statistics",
        description: "Get aggregated statistics for dashboard display including storage metrics, content statistics, and download status",
        response: {
          200: z.object({
            storage: z.object({
              totalDiskSpace: z.number(),
              usedDiskSpace: z.number(),
              availableDiskSpace: z.number(),
              contentSize: z.number(),
              usagePercentage: z.number(),
              volumes: z.array(z.object({
                path: z.string(),
                name: z.string(),
                total: z.number(),
                used: z.number(),
                available: z.number(),
                usagePercentage: z.number(),
              })),
            }),
            content: z.object({
              totalScenes: z.number(),
              scenesWithFiles: z.number(),
              totalFiles: z.number(),
              totalContentSize: z.number(),
              topStudios: z.array(z.object({
                name: z.string(),
                count: z.number(),
                size: z.number(),
              })),
              qualityDistribution: z.array(z.object({
                quality: z.string(),
                count: z.number(),
                size: z.number(),
              })),
            }),
            activeDownloads: z.number(),
            queuedDownloads: z.number(),
            completedDownloads: z.number(),
            failedDownloads: z.number(),
          }),
        },
      },
    },
    async () => {
      return await dashboardController.getStatistics();
    }
  );

  app.get(
    "/providers/status",
    {
      schema: {
        tags: ["dashboard"],
        summary: "Get provider status",
        description: "Get status of all configured providers (metadata, indexers, torrent clients)",
        response: {
          200: z.object({
            metadataProviders: z.array(z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              enabled: z.boolean(),
              status: z.enum(["connected", "disconnected", "error"]),
            })),
            indexers: z.array(z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              enabled: z.boolean(),
              status: z.enum(["connected", "disconnected", "error"]),
            })),
            torrentClients: z.array(z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              enabled: z.boolean(),
              status: z.enum(["connected", "disconnected", "error"]),
            })),
          }),
        },
      },
    },
    async () => {
      return await dashboardController.getProviderStatus();
    }
  );
};

export default dashboardRoutes;
