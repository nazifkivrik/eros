/**
 * Provider Configuration Types
 * Multi-provider support for external services
 */

// Base provider interface
export type BaseProvider = {
  id: string;
  name: string; // User-defined name, e.g., "Main TPDB", "Backup StashDB"
  enabled: boolean;
  priority: number; // Lower = higher priority (1, 2, 3...)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
};

// Metadata Provider Types
export type MetadataProviderType = "tpdb" | "stashdb";

export type MetadataProviderConfig = BaseProvider & {
  type: MetadataProviderType;
  apiUrl: string;
  apiKey: string;
};

// Indexer Provider Types
export type IndexerProviderType = "prowlarr" | "jackett";

export type IndexerProviderConfig = BaseProvider & {
  type: IndexerProviderType;
  baseUrl: string;
  apiKey: string;
};

// Torrent Client Provider Types
export type TorrentClientType = "qbittorrent" | "transmission";

export type TorrentClientConfig = BaseProvider & {
  type: TorrentClientType;
  url: string;
  username?: string;
  password?: string;
};

// Provider Collections
export type ProvidersConfig = {
  metadata: MetadataProviderConfig[];
  indexers: IndexerProviderConfig[];
  torrentClients: TorrentClientConfig[];
};

// Default empty providers config
export const DEFAULT_PROVIDERS: ProvidersConfig = {
  metadata: [],
  indexers: [],
  torrentClients: [],
};
