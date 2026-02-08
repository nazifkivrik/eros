import { z } from "zod";
import type { AppSettings } from "@repo/shared-types";
import type {
  ProvidersConfig,
  MetadataProviderConfig,
  IndexerProviderConfig,
  TorrentClientConfig,
} from "@repo/shared-types";

// Speed Profile Schemas
export const SpeedProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  downloadLimit: z.number(), // KB/s, 0 = unlimited
  uploadLimit: z.number(), // KB/s, 0 = unlimited
});

export const SpeedScheduleSlotSchema = z.object({
  dayOfWeek: z.number().min(0).max(6), // 0-6 (Sunday-Saturday)
  hour: z.number().min(0).max(23), // 0-23
  speedProfileId: z.string(),
});

export const SpeedScheduleSettingsSchema = z.object({
  enabled: z.boolean(),
  profiles: z.array(SpeedProfileSchema),
  schedule: z.array(SpeedScheduleSlotSchema), // 168 slots (7 days × 24 hours)
});

// Download Path Schemas
export const DownloadPathSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  priority: z.number(),
  isDefault: z.boolean().optional(),
});

export const DownloadPathsSettingsSchema = z.object({
  paths: z.array(DownloadPathSchema),
  selectionMode: z.enum(["most-space", "round-robin", "priority"]),
});

// Provider Schemas
export const ProvidersConfigSchema: z.ZodType<ProvidersConfig> = z.object({
  metadata: z.array(z.object({
    id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    priority: z.number(),
    type: z.enum(["tpdb", "stashdb"]),
    apiUrl: z.string(),
    apiKey: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
  indexers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    priority: z.number(),
    type: z.enum(["prowlarr", "jackett"]),
    baseUrl: z.string(),
    apiKey: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
  torrentClients: z.array(z.object({
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
  })),
});

// Zod schema that matches AppSettings interface
export const SettingsSchema: z.ZodType<AppSettings> = z.object({
  general: z.object({
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
  speedSchedule: SpeedScheduleSettingsSchema,
  downloadPaths: DownloadPathsSettingsSchema,
  providers: ProvidersConfigSchema,
});

export const ServiceNameSchema = z.enum(["stashdb", "tpdb", "prowlarr", "qbittorrent"]);

export const TestServiceParamsSchema = z.object({
  service: ServiceNameSchema,
});

export const TestServiceResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Download Path Space Info Schema
export const PathSpaceInfoSchema = z.object({
  path: z.string(),
  free: z.number(), // bytes
  total: z.number(), // bytes
  used: z.number(), // bytes
  freePercent: z.number(), // 0-100
  usedPercent: z.number(), // 0-100
});

// Change Password Schema
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// Change Username Schema
export const ChangeUsernameSchema = z.object({
  currentPassword: z.string().min(1),
  newUsername: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be at most 50 characters"),
});

// Provider Schemas
export const BaseProviderSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  enabled: z.boolean(),
  priority: z.number().int().positive(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const MetadataProviderSchema: z.ZodType<Omit<MetadataProviderConfig, "id" | "createdAt" | "updatedAt">> =
  BaseProviderSchema.extend({
    type: z.enum(["tpdb", "stashdb"]),
    apiUrl: z.string().url("API URL must be a valid URL"),
    apiKey: z.string().min(1, "API key is required"),
  });

export const IndexerProviderSchema: z.ZodType<Omit<IndexerProviderConfig, "id" | "createdAt" | "updatedAt">> =
  BaseProviderSchema.extend({
    type: z.enum(["prowlarr", "jackett"]),
    baseUrl: z.string().url("Base URL must be a valid URL"),
    apiKey: z.string().min(1, "API key is required"),
  });

export const TorrentClientSchema: z.ZodType<Omit<TorrentClientConfig, "id" | "createdAt" | "updatedAt">> =
  BaseProviderSchema.extend({
    type: z.enum(["qbittorrent", "transmission"]),
    url: z.string().url("URL must be a valid URL"),
    username: z.string().optional(),
    password: z.string().optional(),
  });

export const ProviderTypeSchema = z.enum(["metadata", "indexer", "torrentClient"]);
