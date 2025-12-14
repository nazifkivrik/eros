/**
 * Centralized query key factory for React Query
 * Prevents typos and ensures consistency across hooks
 */

export const queryKeys = {
  // Download-related keys
  downloads: {
    unified: ["unified-downloads"] as const,
    queue: ["downloadQueue"] as const,
  },

  // Torrent keys
  torrents: {
    all: ["torrents"] as const,
  },

  // Subscription keys
  subscriptions: {
    all: ["subscriptions"] as const,
    detail: (id: string) => ["subscription", id] as const,
    check: (entityType: string, entityId: string) =>
      ["subscription", "check", entityType, entityId] as const,
    scenes: (id: string) => ["subscription", id, "scenes"] as const,
    files: (id: string) => ["subscription", id, "files"] as const,
  },

  // Quality profile keys
  qualityProfiles: {
    all: ["qualityProfiles"] as const,
    detail: (id: string) => ["qualityProfile", id] as const,
  },

  // Settings keys
  settings: {
    all: ["settings"] as const,
  },

  // Logs keys
  logs: {
    all: ["logs"] as const,
  },

  // Indexer keys
  indexers: {
    all: ["indexers"] as const,
  },

  // Search keys
  search: {
    query: (q: string) => ["search", q] as const,
  },

  // Performer keys
  performers: {
    all: ["performers"] as const,
    detail: (id: string) => ["performer", id] as const,
  },

  // Studio keys
  studios: {
    all: ["studios"] as const,
    detail: (id: string) => ["studio", id] as const,
  },

  // Scene keys
  scenes: {
    all: ["scenes"] as const,
    detail: (id: string) => ["scene", id] as const,
  },

  // Job keys
  jobs: {
    all: ["jobs"] as const,
    progress: (jobName: string) => ["job", "progress", jobName] as const,
  },
} as const;
