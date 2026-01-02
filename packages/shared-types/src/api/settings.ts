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
    enableNotifications: z.boolean(),
    minIndexersForMetadataLess: z.number(),
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
    enabled: z.boolean(),
    modelPath: z.string(),
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
