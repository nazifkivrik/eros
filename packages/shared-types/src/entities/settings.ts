/**
 * Application Settings Types
 * These settings are shared between backend and frontend
 */

export interface GeneralSettings {
  appName: string;
  downloadPath: string;
  scenesPath: string;
  incompletePath: string;
  enableNotifications: boolean;
  minIndexersForMetadataLess: number;
  groupingThreshold: number; // Threshold for merging truncated scene titles (0.0-1.0)
}

export interface FileManagementSettings {
  deleteFilesOnRemove: boolean; // Re-download scene when files are manually deleted from filesystem
  deleteTorrentOnRemove: boolean; // Re-add torrent when manually removed from qBittorrent
  removeFromQbitAfterDays: number;
  renameOnMetadata: boolean;
  autoRedownloadDeletedScenes: boolean; // Auto re-download scenes when files are deleted
  readdManuallyRemovedTorrents: boolean; // Re-add torrents when manually removed from qBittorrent
}

export interface StashDBSettings {
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
}

export interface TPDBSettings {
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
}

export interface MetadataSettings {
  primarySource: "stashdb" | "tpdb";
  enableMultiSource: boolean;
  autoLinkOnMatch: boolean;
  hashLookupEnabled: boolean;
}

export interface ProwlarrSettings {
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
}

export interface QBittorrentSettings {
  url: string;
  username: string;
  password: string;
  enabled: boolean;
}

export interface AISettings {
  enabled: boolean; // Enable AI-powered scene matching with local embeddings
  model: string; // Local embedding model (e.g., "Xenova/all-MiniLM-L6-v2")
  threshold: number; // Cosine similarity threshold for AI matching (0.0-1.0)
}

export interface JobSchedulerSettings {
  subscriptionSearch: {
    enabled: boolean;
    schedule: string; // cron expression
  };
  metadataRefresh: {
    enabled: boolean;
    schedule: string;
  };
  torrentMonitor: {
    enabled: boolean;
    schedule: string;
  };
  cleanup: {
    enabled: boolean;
    schedule: string;
  };
  metadataDiscovery: {
    enabled: boolean;
    schedule: string;
  };
  missingScenesSearch: {
    enabled: boolean;
    schedule: string;
  };
  unifiedSync: {
    enabled: boolean;
    schedule: string;
  };
  qbittorrentCleanup: {
    enabled: boolean;
    schedule: string;
  };
  hashGeneration: {
    enabled: boolean;
    schedule: string;
  };
}

export interface AppSettings {
  general: GeneralSettings;
  fileManagement: FileManagementSettings;
  stashdb: StashDBSettings;
  tpdb: TPDBSettings;
  metadata: MetadataSettings;
  prowlarr: ProwlarrSettings;
  qbittorrent: QBittorrentSettings;
  ai: AISettings;
  jobs: JobSchedulerSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    appName: "Eros",
    downloadPath: "/downloads",
    scenesPath: "/app/media/scenes",
    incompletePath: "/app/media/incomplete",
    enableNotifications: true,
    minIndexersForMetadataLess: 2,
    groupingThreshold: 0.7, // 70% match required for truncated title merging
  },
  fileManagement: {
    deleteFilesOnRemove: false, // Don't re-download by default
    deleteTorrentOnRemove: false, // Don't re-add by default (will unsubscribe)
    removeFromQbitAfterDays: 7,
    renameOnMetadata: true,
    autoRedownloadDeletedScenes: false, // Don't auto re-download by default
    readdManuallyRemovedTorrents: false, // Don't re-add by default
  },
  stashdb: {
    apiUrl: "https://stashdb.org/graphql",
    apiKey: "",
    enabled: false,
  },
  tpdb: {
    apiUrl: "https://api.theporndb.net",
    apiKey: "",
    enabled: false,
  },
  metadata: {
    primarySource: "tpdb",
    enableMultiSource: false,
    autoLinkOnMatch: true,
    hashLookupEnabled: true,
  },
  prowlarr: {
    apiUrl: "",
    apiKey: "",
    enabled: false,
  },
  qbittorrent: {
    url: "",
    username: "",
    password: "",
    enabled: false,
  },
  ai: {
    enabled: false,
    model: "Xenova/all-MiniLM-L6-v2", // Local sentence transformer model
    threshold: 0.75, // 75% cosine similarity for AI matching
  },
  jobs: {
    subscriptionSearch: {
      enabled: true,
      schedule: "0 */6 * * *", // Every 6 hours
    },
    metadataRefresh: {
      enabled: true,
      schedule: "0 2 * * *", // Daily at 2 AM
    },
    torrentMonitor: {
      enabled: true,
      schedule: "*/5 * * * *", // Every 5 minutes
    },
    cleanup: {
      enabled: true,
      schedule: "0 3 * * 0", // Weekly on Sunday at 3 AM
    },
    metadataDiscovery: {
      enabled: true,
      schedule: "0 3 * * *", // Daily at 3 AM
    },
    missingScenesSearch: {
      enabled: true,
      schedule: "0 */8 * * *", // Every 8 hours
    },
    unifiedSync: {
      enabled: true,
      schedule: "*/10 * * * *", // Every 10 minutes
    },
    qbittorrentCleanup: {
      enabled: true,
      schedule: "0 4 * * *", // Daily at 4 AM
    },
    hashGeneration: {
      enabled: true,
      schedule: "0 5 * * *", // Daily at 5 AM
    },
  },
};
