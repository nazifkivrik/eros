import type { EntityType } from "../core/enums.js";
import type { SubscriptionStatus } from "../api/subscription.js";

export type SubscriptionDomain = {
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
};
