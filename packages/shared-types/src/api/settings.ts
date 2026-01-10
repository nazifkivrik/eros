import { z } from "zod";

const ServiceConfigSchema = z.object({
  enabled: z.boolean(),
  apiUrl: z.string(),
  apiKey: z.string(),
});

const JobConfigSchema = z.object({
  enabled: z.boolean(),
  schedule: z.string(),
});

export const AppSettingsSchema = z.object({
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
  stashdb: ServiceConfigSchema,
  tpdb: ServiceConfigSchema,
  prowlarr: ServiceConfigSchema,
  qbittorrent: z.object({
    enabled: z.boolean(),
    url: z.string(),
    username: z.string(),
    password: z.string(),
  }),
  ai: z.object({
    useCrossEncoder: z.boolean().default(true),
    crossEncoderThreshold: z.number().min(0).max(1).default(0.65),
    unknownThreshold: z.number().min(0).max(1).default(0.35),
    groupingCount: z.number().min(1).max(100).default(10),
  }),
  jobs: z.object({
    subscriptionSearch: JobConfigSchema,
    metadataRefresh: JobConfigSchema,
    torrentMonitor: JobConfigSchema,
    cleanup: JobConfigSchema,
    metadataDiscovery: JobConfigSchema,
    missingScenesSearch: JobConfigSchema,
    unifiedSync: JobConfigSchema,
    qbittorrentCleanup: JobConfigSchema,
  }),
});

// Note: AppSettings type is exported from config/settings/app-settings.ts
// This schema is for validation only
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;
export type JobConfig = z.infer<typeof JobConfigSchema>;
