import { z } from "zod";
import { IdParamsSchema } from "../../schemas/common.schema.js";
import { QualityItemSchema } from "../quality-profiles/quality-profiles.schema.js";
import { PerformerSchema, StudioSchema, SceneSchema } from "../search/search.schema.js";

export const EntityTypeSchema = z.enum(["performer", "studio", "scene"]);

export const SubscriptionSchema = z.object({
  id: z.string(),
  entityType: EntityTypeSchema,
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

export const QualityProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  items: z.array(QualityItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SubscriptionDetailResponseSchema = z.object({
  id: z.string(),
  entityType: z.enum(["performer", "studio", "scene"]),
  entityId: z.string(),
  entity: z.union([PerformerSchema, StudioSchema, SceneSchema]).nullable(),
  entityName: z.string(),
  qualityProfile: QualityProfileSchema.nullable(),
  autoDownload: z.boolean(),
  includeMetadataMissing: z.boolean(),
  includeAliases: z.boolean(),
  isSubscribed: z.boolean(),
  searchCutoffDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Response tipi schema'dan üret
export type SubscriptionDetailResponse = z.infer<typeof SubscriptionDetailResponseSchema>;

export const CreateSubscriptionSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string(),
  qualityProfileId: z.string(),
  autoDownload: z.boolean().default(true),
  includeMetadataMissing: z.boolean().default(false),
  includeAliases: z.boolean().default(false),
});

export const UpdateSubscriptionSchema = z.object({
  qualityProfileId: z.string().optional(),
  autoDownload: z.boolean().optional(),
  includeMetadataMissing: z.boolean().optional(),
  includeAliases: z.boolean().optional(),
  isSubscribed: z.boolean().optional(),
});

export const SubscriptionParamsSchema = IdParamsSchema;

export const EntityTypeParamsSchema = z.object({
  entityType: EntityTypeSchema,
});

export const CheckSubscriptionParamsSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string(),
});

export const DeleteSubscriptionQuerySchema = z.object({
  deleteAssociatedScenes: z.coerce.boolean().optional().default(false),
  removeFiles: z.coerce.boolean().optional().default(false),
});

export const SubscriptionListQuerySchema = z.object({
  search: z.string().optional(),
  includeMetaless: z.coerce.boolean().optional().default(false),
  showInactive: z.coerce.boolean().optional().default(false),
});

export const SubscriptionListResponseSchema = z.object({
  data: z.array(SubscriptionDetailResponseSchema),
});

export const SubscriptionsByTypeResponseSchema = z.object({
  data: z.array(SubscriptionSchema),
});

export const CheckSubscriptionResponseSchema = z.object({
  subscribed: z.boolean(),
  subscription: SubscriptionSchema.nullable(),
});
