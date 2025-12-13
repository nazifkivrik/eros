// Entity Types
export type EntityType = "performer" | "studio" | "scene";

export type SubscriptionStatus = "active" | "paused";

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "completed"
  | "failed"
  | "paused";

export type Gender = "male" | "female" | "transgender_male" | "transgender_female" | "intersex" | "non_binary";

export type MetaSourceType = "stashdb" | "theporndb" | "custom";

export type IndexerType = "prowlarr" | "manual";

export type JobStatus = "running" | "completed" | "failed";

// Quality Types
export const QUALITIES = {
  BLURAY_2160P: "2160p_bluray",
  WEBDL_2160P: "2160p_webdl",
  BLURAY_1080P: "1080p_bluray",
  WEBDL_1080P: "1080p_webdl",
  BLURAY_720P: "720p_bluray",
  WEBDL_720P: "720p_webdl",
  WEBDL_480P: "480p_webdl",
  DVD: "dvd",
  ANY: "any",
} as const;

export type Quality = (typeof QUALITIES)[keyof typeof QUALITIES];

export interface QualityItem {
  quality: Quality;
  source: "bluray" | "webdl" | "webrip" | "hdtv" | "dvd" | "any";
  minSeeders: number | "any";
  maxSize: number; // in GB, 0 means unlimited
}

// Image Types
export interface Image {
  url: string;
  width?: number;
  height?: number;
}

// Performer Types
export interface Performer {
  id: string;
  stashdbId: string | null;
  name: string;
  aliases: string[];
  disambiguation: string | null;
  gender: Gender | null;
  birthdate: string | null;
  deathDate: string | null;
  careerStartDate: string | null;
  careerEndDate: string | null;
  images: Image[];
  createdAt: string;
  updatedAt: string;
}

// Studio Types
export interface Studio {
  id: string;
  stashdbId: string | null;
  name: string;
  aliases: string[];
  parentStudioId: string | null;
  images: Image[];
  url: string | null;
  createdAt: string;
  updatedAt: string;
}

// Scene Types
export interface Scene {
  id: string;
  stashdbId: string | null;
  title: string;
  date: string | null;
  details: string | null;
  duration: number | null;
  director: string | null;
  code: string | null;
  urls: string[];
  images: Image[];
  hasMetadata: boolean;
  inferredFromIndexers: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SceneWithRelations extends Scene {
  performers: Performer[];
  studios: Studio[];
  tags: Tag[];
  files: SceneFile[];
}

// Tag Types
export interface Tag {
  id: string;
  name: string;
}

// Subscription Types
export interface Subscription {
  id: string;
  entityType: EntityType;
  entityId: string;
  qualityProfileId: string;
  autoDownload: boolean;
  includeMetadataMissing: boolean;
  includeAliases: boolean;
  status: SubscriptionStatus;
  monitored: boolean;
  searchCutoffDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionWithRelations extends Subscription {
  performer?: Performer;
  studio?: Studio;
  scene?: Scene;
  qualityProfile: QualityProfile;
}

// Quality Profile Types
export interface QualityProfile {
  id: string;
  name: string;
  items: QualityItem[];
  createdAt: string;
  updatedAt: string;
}

// Download Queue Types
export interface DownloadQueueItem {
  id: string;
  sceneId: string;
  torrentHash: string | null;
  indexerId: string;
  title: string;
  size: number;
  seeders: number;
  quality: Quality;
  status: DownloadStatus;
  addedAt: string;
  completedAt: string | null;
}

export interface DownloadQueueItemWithRelations extends DownloadQueueItem {
  scene: Scene;
  indexer: Indexer;
}

// Scene File Types
export interface SceneFile {
  id: string;
  sceneId: string;
  filePath: string;
  size: number;
  quality: Quality;
  dateAdded: string;
  relativePath: string;
}

// Indexer Types
export interface Indexer {
  id: string;
  name: string;
  type: IndexerType;
  baseUrl: string;
  apiKey: string | null;
  priority: number;
  enabled: boolean;
  categories: string[];
  createdAt: string;
}

// Meta Source Types
export interface MetaSource {
  id: string;
  name: string;
  type: MetaSourceType;
  baseUrl: string;
  apiKey: string | null;
  priority: number;
  enabled: boolean;
  createdAt: string;
}

// Search Types
export interface SearchResult {
  performers: Performer[];
  studios: Studio[];
  scenes: SceneWithRelations[];
}

// Torrent Types
export interface Torrent {
  hash: string;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  ratio: number;
  state: string;
  category: string;
  savePath: string;
  addedOn: number;
  completionOn: number | null;
  seeders: number;
  leechers: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

// Settings Types
export interface AppSettings {
  downloadPath: string;
  incompletePath: string;
  qbittorrentUrl: string;
  qbittorrentUsername: string;
  qbittorrentPassword: string;
  prowlarrUrl: string;
  prowlarrApiKey: string;
  stashdbApiUrl: string;
  stashdbApiKey: string;
  aiMatchingEnabled: boolean;
  aiSimilarityThreshold: number;
  sessionSecret: string;
}

// Job Log Types
export interface JobLog {
  id: string;
  jobName: string;
  status: JobStatus;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}
