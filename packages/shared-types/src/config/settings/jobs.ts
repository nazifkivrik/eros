/**
 * Job scheduler settings
 */
export type JobSchedulerSettings = {
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
};

export const DEFAULT_JOB_SCHEDULER_SETTINGS: JobSchedulerSettings = {
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
};
