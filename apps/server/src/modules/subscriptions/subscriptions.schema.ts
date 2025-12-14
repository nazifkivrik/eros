import { z } from "zod";

export const EntityTypeSchema = z.enum(["performer", "studio", "scene"]);

export const SubscriptionSchema = z.object({
  id: z.string(),
  entityType: EntityTypeSchema,
  entityId: z.string(),
  qualityProfileId: z.string(),
  autoDownload: z.boolean(),
  includeMetadataMissing: z.boolean(),
  includeAliases: z.boolean(),
  status: z.string(),
  monitored: z.boolean(),
  searchCutoffDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const QualityProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  items: z.any(), // JSON array of quality items
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SubscriptionWithDetailsSchema = SubscriptionSchema.extend({
  entityName: z.string(),
  entity: z.any().nullable(), // Can be performer, studio, or scene
  qualityProfile: QualityProfileSchema.nullable(),
});

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
  status: z.string().optional(),
  monitored: z.boolean().optional(),
});

export const SubscriptionParamsSchema = z.object({
  id: z.string(),
});

export const EntityTypeParamsSchema = z.object({
  entityType: EntityTypeSchema,
});

export const CheckSubscriptionParamsSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string(),
});

export const DeleteSubscriptionQuerySchema = z.object({
  deleteAssociatedScenes: z.coerce.boolean().optional().default(false),
});

export const SubscriptionListResponseSchema = z.object({
  data: z.array(SubscriptionWithDetailsSchema),
});

export const SubscriptionsByTypeResponseSchema = z.object({
  data: z.array(SubscriptionSchema),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});

export const CheckSubscriptionResponseSchema = z.object({
  subscribed: z.boolean(),
  subscription: SubscriptionSchema.nullable(),
});
