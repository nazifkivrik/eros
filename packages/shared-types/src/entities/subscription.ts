import type { EntityType, SubscriptionStatus, Quality } from "../enums.js";
import type { QualityProfile } from "../shared.js";
import type { Performer } from "./performer.js";
import type { Studio } from "./studio.js";
import type { Scene } from "./scene.js";

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

// Subscription Settings (previously duplicated in frontend)
export interface SubscriptionSettings {
  qualityProfileId: string;
  autoDownload: boolean;
  includeMetadataMissing: boolean;
  includeAliases: boolean;
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
  status: "queued" | "downloading" | "completed" | "failed" | "paused";
  addedAt: string;
  completedAt: string | null;
}

export interface DownloadQueueItemWithRelations extends DownloadQueueItem {
  scene: Scene;
  indexer: {
    id: string;
    name: string;
    type: "prowlarr" | "manual";
  };
}
