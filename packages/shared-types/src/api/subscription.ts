import { z } from "zod";
import { PerformerSchema, StudioSchema, SceneSchema } from "./entities.js";
import { QualityProfileSchema } from "./quality-profile.js";

export const SubscriptionEntityTypeSchema = z.enum(["performer", "studio", "scene"]);

export const SubscriptionSettingsSchema = z.object({
  qualityProfileId: z.string(),
  autoDownload: z.boolean(),
  includeMetadataMissing: z.boolean(),
  includeAliases: z.boolean(),
});

export const SubscriptionSchema = z.object({
  id: z.string(),
  entityType: SubscriptionEntityTypeSchema,
  entityId: z.string(),
  qualityProfileId: z.string(),
  autoDownload: z.boolean(),
  includeMetadataMissing: z.boolean(),
  includeAliases: z.boolean(),
  isSubscribed: z.boolean(),
  searchCutoffDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SubscriptionDetailSchema = z.object({
  id: z.string(),
  entityType: SubscriptionEntityTypeSchema,
  entityId: z.string(),
  entityName: z.string(),
  entity: z.union([PerformerSchema, StudioSchema, SceneSchema]).nullable(),
  qualityProfileId: z.string(),
  qualityProfile: QualityProfileSchema.nullable(),
  autoDownload: z.boolean(),
  includeMetadataMissing: z.boolean(),
  includeAliases: z.boolean(),
  isSubscribed: z.boolean(),
  searchCutoffDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Tip schema'dan üret
export type SubscriptionEntityType = z.infer<typeof SubscriptionEntityTypeSchema>;
export type SubscriptionSettings = z.infer<typeof SubscriptionSettingsSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type SubscriptionDetail = z.infer<typeof SubscriptionDetailSchema>;
