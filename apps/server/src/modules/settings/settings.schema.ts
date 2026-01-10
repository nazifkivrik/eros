import { z } from "zod";
import type { AppSettings } from "@repo/shared-types";

// Zod schema that matches AppSettings interface
export const SettingsSchema: z.ZodType<AppSettings> = z.object({
  general: z.object({
    appName: z.string(),
    downloadPath: z.string(),
    scenesPath: z.string(),
    incompletePath: z.string(),
  }),
  fileManagement: z.object({
    deleteFilesOnRemove: z.boolean(),
    deleteTorrentOnRemove: z.boolean(),
    removeFromQbitAfterDays: z.number(),
    renameOnMetadata: z.boolean(),
  }),
  stashdb: z.object({
    apiUrl: z.string(),
    apiKey: z.string(),
    enabled: z.boolean(),
  }),
  tpdb: z.object({
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
    useCrossEncoder: z.boolean(),
    crossEncoderThreshold: z.number(),
    unknownThreshold: z.number(),
    groupingCount: z.number(),
  }),
  jobs: z.object({
    subscriptionSearch: z.object({
      enabled: z.boolean(),
      schedule: z.string(),
    }),
    metadataRefresh: z.object({
      enabled: z.boolean(),
      schedule: z.string(),
    }),
    torrentMonitor: z.object({
      enabled: z.boolean(),
      schedule: z.string(),
    }),
    cleanup: z.object({
      enabled: z.boolean(),
      schedule: z.string(),
    }),
    metadataDiscovery: z.object({
      enabled: z.boolean(),
      schedule: z.string(),
    }),
    missingScenesSearch: z.object({
      enabled: z.boolean(),
      schedule: z.string(),
    }),
    unifiedSync: z.object({
      enabled: z.boolean(),
      schedule: z.string(),
    }),
    qbittorrentCleanup: z.object({
      enabled: z.boolean(),
      schedule: z.string(),
    }),
  }),
});

export const ServiceNameSchema = z.enum(["stashdb", "tpdb", "prowlarr", "qbittorrent"]);

export const TestServiceParamsSchema = z.object({
  service: ServiceNameSchema,
});

export const TestServiceResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
