/**
 * Type unions and enums used across the application
 * Note: Status types (SubscriptionStatus, DownloadStatus, JobStatus) are now defined
 * in api/ as Zod schemas and should be imported from there
 */

// Entity Types
export type EntityType = "performer" | "studio" | "scene";

// Domain Types
export type Gender =
  | "male"
  | "female"
  | "transgender_male"
  | "transgender_female"
  | "intersex"
  | "non_binary";

// Integration Types
export type MetaSourceType = "stashdb" | "theporndb" | "custom";
