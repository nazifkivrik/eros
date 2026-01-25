import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  SettingsSchema,
  TestServiceParamsSchema,
  TestServiceResponseSchema,
} from "./settings.schema.js";

/**
 * Settings Routes
 * Pure HTTP routing - delegates to controller
 * Clean Architecture: Route → Controller → Service → Repository
 */
const settingsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get controller from DI container
  const { settingsController } = app.container;

  // Get settings
  app.get(
    "/",
    {
      schema: {
        tags: ["settings"],
        summary: "Get settings",
        description: "Retrieve all application settings including qBittorrent, Prowlarr, TPDB, StashDB, and AI configuration",
        response: {
          200: SettingsSchema,
        },
      },
    },
    async () => {
      return await settingsController.getSettings();
    }
  );

  // Update settings
  app.put(
    "/",
    {
      schema: {
        tags: ["settings"],
        summary: "Update settings",
        description: "Update application settings and automatically reload affected plugins (qBittorrent, TPDB, StashDB)",
        body: SettingsSchema,
        response: {
          200: SettingsSchema,
        },
      },
    },
    async (request) => {
      return await settingsController.updateSettings(request.body, app);
    }
  );

  // Test service connection
  app.post(
    "/test/:service",
    {
      schema: {
        tags: ["settings"],
        summary: "Test service connection",
        description: "Test connection to configured external services (qBittorrent, Prowlarr, TPDB, StashDB)",
        params: TestServiceParamsSchema,
        response: {
          200: TestServiceResponseSchema,
        },
      },
    },
    async (request) => {
      return await settingsController.testConnection(request.params);
    }
  );

  // Test TPDB connection with provided credentials
  app.post(
    "/test/tpdb",
    {
      schema: {
        tags: ["settings"],
        summary: "Test TPDB connection",
        description: "Test TPDB connection with provided API URL and key before saving to settings",
        body: z.object({
          apiUrl: z.string().url().describe("TPDB API URL"),
          apiKey: z.string().min(1).describe("TPDB API key"),
        }),
        response: {
          200: z.object({
            success: z.boolean().describe("Whether the connection test succeeded"),
            message: z.string().describe("Success or error message"),
          }),
        },
      },
    },
    async (request) => {
      return await settingsController.testTPDBConnection(request.body);
    }
  );

  // Get qBittorrent status
  app.get(
    "/qbittorrent/status",
    {
      schema: {
        tags: ["settings"],
        summary: "Get qBittorrent status",
        description: "Check qBittorrent connection status and retrieve current download/upload statistics",
        response: {
          200: z.object({
            connected: z.boolean().describe("Whether qBittorrent is connected"),
            torrentsCount: z.number().optional().describe("Total number of active torrents"),
            downloadSpeed: z.number().optional().describe("Current download speed in bytes/s"),
            uploadSpeed: z.number().optional().describe("Current upload speed in bytes/s"),
            error: z.string().optional().describe("Error message if connection failed"),
          }),
        },
      },
    },
    async () => {
      return await settingsController.getQBittorrentStatus();
    }
  );

  // Get AI model status
  app.get(
    "/ai/status",
    {
      schema: {
        tags: ["settings"],
        summary: "Get AI model status",
        description: "Check AI model loading status and error information",
        response: {
          200: z.object({
            enabled: z.boolean().describe("Whether AI matching is enabled in settings"),
            modelLoaded: z.boolean().describe("Whether the Cross-Encoder model is loaded in RAM"),
            modelDownloaded: z.boolean().describe("Whether the model files are downloaded to disk"),
            modelName: z.string().describe("Name of the model being used"),
            modelPath: z.string().describe("Path where model files are stored"),
            error: z.string().nullable().describe("Error message if model failed to load"),
          }),
        },
      },
    },
    async () => {
      return await settingsController.getAIModelStatus();
    }
  );

  // Manually load AI model
  app.post(
    "/ai/load",
    {
      schema: {
        tags: ["settings"],
        summary: "Download AI model",
        description: "Download AI model to local cache. Model will be loaded into RAM automatically when needed.",
        response: {
          200: z.object({
            success: z.boolean().describe("Whether the model was downloaded successfully"),
            message: z.string().describe("Status message"),
            modelLoaded: z.boolean().describe("Whether the model is loaded after the operation"),
          }),
        },
      },
    },
    async () => {
      try {
        return await settingsController.loadAIModel();
      } catch (error) {
        throw error;
      }
    }
  );
};

export default settingsRoutes;
