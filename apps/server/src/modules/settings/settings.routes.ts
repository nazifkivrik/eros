import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { createSettingsService } from "../../services/settings.service.js";
import { createQBittorrentService } from "../../services/qbittorrent.service.js";

const SettingsSchema = z.object({
  general: z.object({
    appName: z.string(),
    downloadPath: z.string(),
    enableNotifications: z.boolean(),
    minIndexersForMetadataLess: z.number(),
    groupingThreshold: z.number().optional(),
    deleteFilesOnRemove: z.boolean().optional(),
    deleteTorrentOnRemove: z.boolean().optional(),
  }),
  stashdb: z.object({
    apiUrl: z.string(),
    apiKey: z.string(),
    enabled: z.boolean(),
  }),
  prowlarr: z.object({
    apiUrl: z.string(),
    apiKey: z.string(),
    enabled: z.boolean(),
  }),
  qbittorrent: z.object({
    url: z.string(),
    username: z.string(),
    password: z.string(),
    enabled: z.boolean(),
  }),
  ai: z.object({
    enabled: z.boolean(),
    model: z.string(),
    threshold: z.number(),
  }),
});

const settingsRoutes: FastifyPluginAsyncZod = async (app) => {
  const settingsService = createSettingsService(app.db);

  // Get settings
  app.get(
    "/",
    {
      schema: {
        response: {
          200: SettingsSchema,
        },
      },
    },
    async () => {
      return await settingsService.getSettings();
    }
  );

  // Update settings
  app.put(
    "/",
    {
      schema: {
        body: SettingsSchema,
        response: {
          200: SettingsSchema,
        },
      },
    },
    async (request) => {
      return await settingsService.updateSettings(request.body);
    }
  );

  // Test service connection
  app.post(
    "/test/:service",
    {
      schema: {
        params: z.object({
          service: z.enum(["stashdb", "prowlarr", "qbittorrent"]),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const { service } = request.params;
      return await settingsService.testConnection(service);
    }
  );

  // Get qBittorrent status
  app.get(
    "/qbittorrent/status",
    {
      schema: {
        response: {
          200: z.object({
            connected: z.boolean(),
            torrentsCount: z.number().optional(),
            downloadSpeed: z.number().optional(),
            uploadSpeed: z.number().optional(),
            error: z.string().optional(),
          }),
        },
      },
    },
    async () => {
      const settings = await settingsService.getSettings();
      const qbConfig = settings.qbittorrent;

      if (!qbConfig.enabled || !qbConfig.url) {
        return {
          connected: false,
          error: "qBittorrent not configured",
        };
      }

      try {
        const qbService = createQBittorrentService({
          url: qbConfig.url,
          username: qbConfig.username,
          password: qbConfig.password,
        });

        const torrents = await qbService.getTorrents();
        const downloadSpeed = torrents.reduce((sum, t) => sum + (t.dlspeed || 0), 0);
        const uploadSpeed = torrents.reduce((sum, t) => sum + (t.upspeed || 0), 0);

        return {
          connected: true,
          torrentsCount: torrents.length,
          downloadSpeed,
          uploadSpeed,
        };
      } catch (error) {
        return {
          connected: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );
};

export default settingsRoutes;
