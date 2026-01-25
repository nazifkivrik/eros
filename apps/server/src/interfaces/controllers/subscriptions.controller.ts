import type { Logger } from "pino";
import { z } from "zod";
import { SubscriptionsService } from "@/application/services/subscriptions.service.js";
import type { Subscription } from "@repo/shared-types";
import {
  CreateSubscriptionSchema,
  UpdateSubscriptionSchema,
  SubscriptionParamsSchema,
  EntityTypeParamsSchema,
  CheckSubscriptionParamsSchema,
  DeleteSubscriptionQuerySchema,
  SubscriptionListQuerySchema,
  SubscriptionListResponseSchema,
  SubscriptionsByTypeResponseSchema,
  SubscriptionDetailResponseSchema,
  CheckSubscriptionResponseSchema,
} from "@/modules/subscriptions/subscriptions.schema.js";

/**
 * Subscriptions Controller
 * Handles HTTP request/response for subscriptions endpoints
 * Responsibilities:
 * - Request validation (Zod)
 * - Calling service methods
 * - Error handling
 * - Response formatting
 */
export class SubscriptionsController {
  private subscriptionsService: SubscriptionsService;
  private logger: Logger;

  constructor({
    subscriptionsService,
    logger,
  }: {
    subscriptionsService: SubscriptionsService;
    logger: Logger;
  }) {
    this.subscriptionsService = subscriptionsService;
    this.logger = logger;
  }

  /**
   * List all subscriptions with details
   */
  async list(query?: unknown): Promise<z.infer<typeof SubscriptionListResponseSchema>> {
    // Parse and validate query parameters using Zod schema
    const parsedQuery = query ? SubscriptionListQuerySchema.parse(query) : {
      search: undefined,
      includeMetaless: undefined,
      showInactive: undefined,
    };

    // Only include filters that have actual values
    const filters = {
      search: parsedQuery.search || undefined,
      includeMetaless: parsedQuery.includeMetaless || undefined,
      showInactive: parsedQuery.showInactive || undefined,
    };

    const subscriptions = await this.subscriptionsService.getAllWithDetails(filters);
    return { data: subscriptions };
  }

  /**
   * Get subscriptions by type
   */
  async getByType(params: unknown): Promise<z.infer<typeof SubscriptionsByTypeResponseSchema>> {
    const validated = EntityTypeParamsSchema.parse(params);
    const subscriptions = await this.subscriptionsService.getByType(validated.entityType);
    return { data: subscriptions };
  }

  /**
   * Get subscription by ID with details
   */
  async getById(params: unknown): Promise<z.infer<typeof SubscriptionDetailResponseSchema>> {
    const validated = SubscriptionParamsSchema.parse(params);
    const subscription = await this.subscriptionsService.getByIdWithDetails(validated.id);
    return subscription as z.infer<typeof SubscriptionDetailResponseSchema>;
  }

  /**
   * Create subscription
   */
  async create(body: unknown): Promise<Subscription> {
    const validated = CreateSubscriptionSchema.parse(body);

    const subscription = await this.subscriptionsService.create({
      entityType: validated.entityType,
      entityId: validated.entityId,
      qualityProfileId: validated.qualityProfileId,
      autoDownload: validated.autoDownload,
      includeMetadataMissing: validated.includeMetadataMissing,
      includeAliases: validated.includeAliases,
    });

    return subscription as Subscription;
  }

  /**
   * Update subscription
   */
  async update(params: unknown, body: unknown): Promise<Subscription> {
    const validatedParams = SubscriptionParamsSchema.parse(params);
    const validatedBody = UpdateSubscriptionSchema.parse(body);

    const updated = await this.subscriptionsService.update(validatedParams.id, {
      qualityProfileId: validatedBody.qualityProfileId,
      autoDownload: validatedBody.autoDownload,
      includeMetadataMissing: validatedBody.includeMetadataMissing,
      includeAliases: validatedBody.includeAliases,
      isSubscribed: validatedBody.isSubscribed,
    });

    return updated as Subscription;
  }

  /**
   * Delete subscription
   */
  async delete(params: unknown, query: unknown): Promise<{ success: boolean }> {
    const validatedParams = SubscriptionParamsSchema.parse(params);
    const validatedQuery = DeleteSubscriptionQuerySchema.parse(query);

    await this.subscriptionsService.delete(validatedParams.id, {
      deleteAssociatedScenes: validatedQuery.deleteAssociatedScenes,
      removeFiles: validatedQuery.removeFiles,
    });

    return { success: true };
  }

  /**
   * Toggle status (active <-> inactive)
   */
  async toggleStatus(params: unknown): Promise<Subscription> {
    const validated = SubscriptionParamsSchema.parse(params);
    const subscription = await this.subscriptionsService.toggleStatus(validated.id);
    return subscription as Subscription;
  }

  /**
   * Check subscription status by entity
   */
  async checkSubscription(params: unknown): Promise<z.infer<typeof CheckSubscriptionResponseSchema>> {
    const validated = CheckSubscriptionParamsSchema.parse(params);

    const result = await this.subscriptionsService.checkSubscriptionByEntity(
      validated.entityType,
      validated.entityId
    );

    return result;
  }

  /**
   * Get scenes for performer/studio subscription
   */
  async getSubscriptionScenes(params: unknown): Promise<{ data: unknown[] }> {
    const validated = SubscriptionParamsSchema.parse(params);
    const scenes = await this.subscriptionsService.getSubscriptionScenes(validated.id);
    return { data: scenes };
  }

  /**
   * Get files for scene subscription
   */
  async getSubscriptionFiles(params: unknown): Promise<{
    files: unknown[];
    downloadQueue: unknown | null;
    sceneFolder: string | null;
    folderContents: {
      nfoFiles: string[];
      posterFiles: string[];
      videoFiles: string[];
    };
  }> {
    const validated = SubscriptionParamsSchema.parse(params);
    const result = await this.subscriptionsService.getSubscriptionFiles(validated.id);
    // Return base result, route will add sceneFolder and folderContents
    return {
      files: (result as any).files || [],
      downloadQueue: (result as any).downloadQueue || null,
      sceneFolder: null,
      folderContents: { nfoFiles: [], posterFiles: [], videoFiles: [] }
    };
  }
}
