import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { createSettingsService } from "../../services/settings.service.js";
import { createQBittorrentService } from "../../services/qbittorrent.service.js";
import {
  SettingsSchema,
  TestServiceParamsSchema,
  TestServiceResponseSchema,
} from "./settings.schema.js";

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
      const updatedSettings = await settingsService.updateSettings(request.body);

      // Reload StashDB plugin with new settings
      if (updatedSettings.stashdb?.apiKey) {
        const { StashDBService } = await import("../../services/stashdb.service.js");
        const stashdb = new StashDBService({
          apiUrl: "https://stashdb.org/graphql",
          apiKey: updatedSettings.stashdb.apiKey,
        });
        // Directly reassign the decorator value (plugin already initialized it)
        app.stashdb = stashdb;
        app.log.info("StashDB plugin reloaded with new API key");
      }

      // Reload TPDB plugin with new settings
      if (updatedSettings.tpdb?.apiKey) {
        const { TPDBService } = await import("../../services/tpdb/tpdb.service.js");
        const tpdb = new TPDBService({
          apiUrl: updatedSettings.tpdb.apiUrl || "https://api.theporndb.net",
          apiKey: updatedSettings.tpdb.apiKey,
        });
        app.tpdb = tpdb;
        app.log.info("TPDB plugin reloaded with new API key");
      }

      // Reload qBittorrent plugin with new settings
      if (updatedSettings.qbittorrent?.enabled && updatedSettings.qbittorrent?.url) {
        const { QBittorrentService } = await import("../../services/qbittorrent.service.js");
        const qbittorrent = new QBittorrentService({
          url: updatedSettings.qbittorrent.url,
          username: updatedSettings.qbittorrent.username || "admin",
          password: updatedSettings.qbittorrent.password || "adminadmin",
        });

        try {
          const connected = await qbittorrent.testConnection();
          if (connected) {
            // Directly reassign the decorator value (plugin already initialized it)
            app.qbittorrent = qbittorrent;
            app.log.info("qBittorrent plugin reloaded and connected");
          } else {
            app.qbittorrent = null;
            app.log.warn("qBittorrent plugin reloaded but connection failed");
          }
        } catch (error) {
          app.qbittorrent = null;
          app.log.error({ error }, "Failed to reload qBittorrent plugin");
        }
      } else {
        app.qbittorrent = null;
      }

      return updatedSettings;
    }
  );

  // Test service connection
  app.post(
    "/test/:service",
    {
      schema: {
        params: TestServiceParamsSchema,
        response: {
          200: TestServiceResponseSchema,
        },
      },
    },
    async (request) => {
      const { service } = request.params;
      return await settingsService.testConnection(service);
    }
  );

  // Test TPDB connection with provided credentials
  app.post(
    "/test/tpdb",
    {
      schema: {
        body: z.object({
          apiUrl: z.string().url(),
          apiKey: z.string().min(1),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { apiUrl, apiKey } = request.body;

      const isConnected = await settingsService.testTPDBConnectionPublic(apiUrl, apiKey);

      return reply.send({
        success: isConnected,
        message: isConnected
          ? "Successfully connected to TPDB"
          : "Failed to connect to TPDB. Check your API URL and key.",
      });
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
