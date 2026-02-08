import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  SettingsSchema,
  TestServiceParamsSchema,
  TestServiceResponseSchema,
  SpeedScheduleSettingsSchema,
  DownloadPathsSettingsSchema,
  PathSpaceInfoSchema,
  ChangePasswordSchema,
  ChangeUsernameSchema,
  ProvidersConfigSchema,
  MetadataProviderSchema,
  IndexerProviderSchema,
  TorrentClientSchema,
  ProviderTypeSchema,
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

  // Speed Schedule Routes

  // Get speed schedule settings
  app.get(
    "/speed-schedule",
    {
      schema: {
        tags: ["settings"],
        summary: "Get speed schedule settings",
        description: "Retrieve speed schedule settings including profiles and weekly calendar",
        response: {
          200: SpeedScheduleSettingsSchema,
        },
      },
    },
    async () => {
      return await settingsController.getSpeedSchedule();
    }
  );

  // Update speed schedule settings
  app.put(
    "/speed-schedule",
    {
      schema: {
        tags: ["settings"],
        summary: "Update speed schedule settings",
        description: "Update speed schedule settings including profiles and weekly calendar",
        body: SpeedScheduleSettingsSchema,
        response: {
          200: SpeedScheduleSettingsSchema,
        },
      },
    },
    async (request) => {
      return await settingsController.updateSpeedSchedule(request.body);
    }
  );

  // Download Paths Routes

  // Get download paths settings
  app.get(
    "/download-paths",
    {
      schema: {
        tags: ["settings"],
        summary: "Get download paths settings",
        description: "Retrieve download paths settings",
        response: {
          200: DownloadPathsSettingsSchema,
        },
      },
    },
    async () => {
      return await settingsController.getDownloadPaths();
    }
  );

  // Update download paths settings
  app.put(
    "/download-paths",
    {
      schema: {
        tags: ["settings"],
        summary: "Update download paths settings",
        description: "Update download paths settings",
        body: DownloadPathsSettingsSchema,
        response: {
          200: DownloadPathsSettingsSchema,
        },
      },
    },
    async (request) => {
      return await settingsController.updateDownloadPaths(request.body);
    }
  );

  // Check disk space for a path
  app.post(
    "/download-paths/check-space",
    {
      schema: {
        tags: ["settings"],
        summary: "Check disk space for a path",
        description: "Check available disk space for a given path",
        body: z.object({
          path: z.string(),
        }),
        response: {
          200: PathSpaceInfoSchema,
        },
      },
    },
    async (request) => {
      return await settingsController.checkPathSpace(request.body.path);
    }
  );

  // User Routes

  // Change password
  app.post(
    "/user/change-password",
    {
      schema: {
        tags: ["settings"],
        summary: "Change user password",
        description: "Change the current user's password",
        body: ChangePasswordSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      return await settingsController.changePassword(request.body);
    }
  );

  // Change username
  app.post(
    "/user/change-username",
    {
      schema: {
        tags: ["settings"],
        summary: "Change user username",
        description: "Change the current user's username",
        body: ChangeUsernameSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => {
      return await settingsController.changeUsername(request.body);
    }
  );

  // ====== Provider Routes ======
  // Multi-provider management for metadata providers, indexers, and torrent clients

  // Get all providers
  app.get(
    "/providers",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Get all providers",
        description: "Retrieve all configured providers (metadata, indexers, torrent clients)",
        response: {
          200: ProvidersConfigSchema,
        },
      },
    },
    async () => {
      return await settingsController.getProviders();
    }
  );

  // ====== Metadata Provider Routes ======

  // Add metadata provider
  app.post(
    "/providers/metadata",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Add metadata provider",
        description: "Add a new metadata provider (TPDB, StashDB)",
        body: MetadataProviderSchema,
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            enabled: z.boolean(),
            priority: z.number(),
            type: z.enum(["tpdb", "stashdb"]),
            apiUrl: z.string(),
            apiKey: z.string(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      return await settingsController.addMetadataProvider(request.body);
    }
  );

  // Update metadata provider
  app.put(
    "/providers/metadata/:id",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Update metadata provider",
        description: "Update an existing metadata provider",
        params: z.object({
          id: z.string(),
        }),
        body: MetadataProviderSchema.partial(),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            enabled: z.boolean(),
            priority: z.number(),
            type: z.enum(["tpdb", "stashdb"]),
            apiUrl: z.string(),
            apiKey: z.string(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        return await settingsController.updateMetadataProvider(
          request.params.id,
          request.body
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Delete metadata provider
  app.delete(
    "/providers/metadata/:id",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Delete metadata provider",
        description: "Delete a metadata provider",
        params: z.object({
          id: z.string(),
        }),
        response: {
          204: z.undefined(),
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        await settingsController.deleteMetadataProvider(request.params.id);
        return reply.code(204).send();
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Test metadata provider connection
  app.post(
    "/providers/metadata/:id/test",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Test metadata provider connection",
        description: "Test connection to a metadata provider",
        params: z.object({
          id: z.string(),
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
      return await settingsController.testProviderConnection("metadata", request.params.id);
    }
  );

  // ====== Indexer Provider Routes ======

  // Add indexer provider
  app.post(
    "/providers/indexers",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Add indexer provider",
        description: "Add a new indexer provider (Prowlarr, Jackett)",
        body: IndexerProviderSchema,
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            enabled: z.boolean(),
            priority: z.number(),
            type: z.enum(["prowlarr", "jackett"]),
            baseUrl: z.string(),
            apiKey: z.string(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      return await settingsController.addIndexerProvider(request.body);
    }
  );

  // Update indexer provider
  app.put(
    "/providers/indexers/:id",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Update indexer provider",
        description: "Update an existing indexer provider",
        params: z.object({
          id: z.string(),
        }),
        body: IndexerProviderSchema.partial(),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            enabled: z.boolean(),
            priority: z.number(),
            type: z.enum(["prowlarr", "jackett"]),
            baseUrl: z.string(),
            apiKey: z.string(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        return await settingsController.updateIndexerProvider(
          request.params.id,
          request.body
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Delete indexer provider
  app.delete(
    "/providers/indexers/:id",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Delete indexer provider",
        description: "Delete an indexer provider",
        params: z.object({
          id: z.string(),
        }),
        response: {
          204: z.undefined(),
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        await settingsController.deleteIndexerProvider(request.params.id);
        return reply.code(204).send();
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Test indexer provider connection
  app.post(
    "/providers/indexers/:id/test",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Test indexer provider connection",
        description: "Test connection to an indexer provider",
        params: z.object({
          id: z.string(),
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
      return await settingsController.testProviderConnection("indexer", request.params.id);
    }
  );

  // ====== Torrent Client Provider Routes ======

  // Add torrent client provider
  app.post(
    "/providers/torrent-clients",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Add torrent client provider",
        description: "Add a new torrent client provider (qBittorrent, Transmission)",
        body: TorrentClientSchema,
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            enabled: z.boolean(),
            priority: z.number(),
            type: z.enum(["qbittorrent", "transmission"]),
            url: z.string(),
            username: z.string().optional(),
            password: z.string().optional(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      return await settingsController.addTorrentClientProvider(request.body);
    }
  );

  // Update torrent client provider
  app.put(
    "/providers/torrent-clients/:id",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Update torrent client provider",
        description: "Update an existing torrent client provider",
        params: z.object({
          id: z.string(),
        }),
        body: TorrentClientSchema.partial(),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            enabled: z.boolean(),
            priority: z.number(),
            type: z.enum(["qbittorrent", "transmission"]),
            url: z.string(),
            username: z.string().optional(),
            password: z.string().optional(),
            createdAt: z.string(),
            updatedAt: z.string(),
          }),
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        return await settingsController.updateTorrentClientProvider(
          request.params.id,
          request.body
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Delete torrent client provider
  app.delete(
    "/providers/torrent-clients/:id",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Delete torrent client provider",
        description: "Delete a torrent client provider",
        params: z.object({
          id: z.string(),
        }),
        response: {
          204: z.undefined(),
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        await settingsController.deleteTorrentClientProvider(request.params.id);
        return reply.code(204).send();
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Test torrent client provider connection
  app.post(
    "/providers/torrent-clients/:id/test",
    {
      schema: {
        tags: ["settings", "providers"],
        summary: "Test torrent client provider connection",
        description: "Test connection to a torrent client provider",
        params: z.object({
          id: z.string(),
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
      return await settingsController.testProviderConnection("torrentClient", request.params.id);
    }
  );
};

export default settingsRoutes;
