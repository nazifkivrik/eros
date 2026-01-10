import type { EntityType } from "../core/enums.js";

export type SubscriptionDomain = {
  id: string;
  entityType: EntityType;
  entityId: string;
  qualityProfileId: string;
  autoDownload: boolean;
  includeMetadataMissing: boolean;
  includeAliases: boolean;
  isSubscribed: boolean;
  searchCutoffDate: string | null;
  createdAt: string;
  updatedAt: string;
};
