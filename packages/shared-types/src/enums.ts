// Entity and Status Enums
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

// Log enums (moved from logs.service.ts)
export type LogLevel = "error" | "warning" | "info" | "debug";

export type EventType = "torrent" | "subscription" | "download" | "metadata" | "system" ;

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
