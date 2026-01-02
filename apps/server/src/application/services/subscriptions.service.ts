import { nanoid } from "nanoid";
import type { Logger } from "pino";
import type { SubscriptionStatus } from "@repo/shared-types";
import { SubscriptionsRepository } from "../../infrastructure/repositories/subscriptions.repository.js";
import { SubscriptionService as LegacySubscriptionService } from "../../services/subscription.service.js";

/**
 * DTOs for Subscriptions Service
 * These should eventually move to @repo/shared-types
 */
export interface CreateSubscriptionDTO {
  entityType: "performer" | "studio" | "scene";
  entityId: string;
  qualityProfileId: string;
  autoDownload: boolean;
  includeMetadataMissing: boolean;
  includeAliases: boolean;
}

export interface UpdateSubscriptionDTO {
  qualityProfileId?: string;
  autoDownload?: boolean;
  includeMetadataMissing?: boolean;
  includeAliases?: boolean;
  status?: SubscriptionStatus;
  monitored?: boolean;
  searchCutoffDate?: string | null;
}

export interface DeleteSubscriptionDTO {
  deleteAssociatedScenes?: boolean;
  removeFiles?: boolean;
}

/**
 * Subscriptions Service (Clean Architecture)
 * Business logic for subscription management
 * Delegates complex operations to legacy service temporarily
 */
export class SubscriptionsService {
  private subscriptionsRepository: SubscriptionsRepository;
  private subscriptionService: LegacySubscriptionService;
  private logger: Logger;

  constructor({
    subscriptionsRepository,
    subscriptionService,
    logger,
  }: {
    subscriptionsRepository: SubscriptionsRepository;
    subscriptionService: LegacySubscriptionService;
    logger: Logger;
  }) {
    this.subscriptionsRepository = subscriptionsRepository;
    this.subscriptionService = subscriptionService;
    this.logger = logger;
  }

  /**
   * Get all subscriptions
   */
  async getAll() {
    this.logger.info("Fetching all subscriptions");
    const subscriptions = await this.subscriptionsRepository.findAll();
    return subscriptions;
  }

  /**
   * Get all subscriptions with details (entity + quality profile)
   */
  async getAllWithDetails() {
    this.logger.info("Fetching all subscriptions with details");
    // Delegate to legacy service for complex operation
    return await this.subscriptionService.getAllSubscriptionsWithDetails();
  }

  /**
   * Get subscriptions by type
   */
  async getByType(entityType: string) {
    this.logger.info({ entityType }, "Fetching subscriptions by type");
    return await this.subscriptionsRepository.findByType(entityType);
  }

  /**
   * Get subscription by ID
   */
  async getById(id: string) {
    this.logger.info({ subscriptionId: id }, "Fetching subscription by ID");
    const subscription = await this.subscriptionsRepository.findById(id);

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    return subscription;
  }

  /**
   * Get subscription with details
   */
  async getByIdWithDetails(id: string) {
    this.logger.info({ subscriptionId: id }, "Fetching subscription with details");
    const subscription = await this.subscriptionsRepository.findByIdWithDetails(id);

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    let entityName = "Unknown";

    if (subscription.entity) {
      const entity = subscription.entity as any;
      if (subscription.entityType === "performer" || subscription.entityType === "studio") {
        entityName = entity.name;
      } else if (subscription.entityType === "scene") {
        entityName = entity.title;
      }
    }

    if (!entityName || entityName === "Unknown") {
      entityName = subscription.entityId;
    }

    return {
      ...subscription,
      entityName,
    };
  }

  /**
   * Check subscription status by entity
   */
  async checkSubscriptionByEntity(entityType: string, entityId: string) {
    this.logger.info({ entityType, entityId }, "Checking subscription by entity");
    const subscription = await this.subscriptionsRepository.findByEntity(
      entityType,
      entityId
    );

    return {
      subscribed: !!subscription,
      subscription: subscription || null,
    };
  }

  /**
   * Create subscription
   * Delegates to legacy service for complex creation logic
   */
  async create(dto: CreateSubscriptionDTO) {
    this.logger.info({ entityType: dto.entityType, entityId: dto.entityId }, "Creating subscription");

    // Delegate to legacy service which handles:
    // - Entity resolution
    // - Scene subscription creation
    // - TPDB integration
    return await this.subscriptionService.createSubscription(dto);
  }

  /**
   * Update subscription
   */
  async update(id: string, dto: UpdateSubscriptionDTO) {
    this.logger.info({ subscriptionId: id }, "Updating subscription");

    // Check if exists
    const exists = await this.subscriptionsRepository.exists(id);
    if (!exists) {
      throw new Error("Subscription not found");
    }

    // Delegate to legacy service for complex update logic
    return await this.subscriptionService.updateSubscription(id, dto);
  }

  /**
   * Delete subscription
   */
  async delete(id: string, dto: DeleteSubscriptionDTO) {
    this.logger.info({ subscriptionId: id, ...dto }, "Deleting subscription");

    // Check if exists
    const exists = await this.subscriptionsRepository.exists(id);
    if (!exists) {
      throw new Error("Subscription not found");
    }

    // Delegate to legacy service for complex deletion logic
    await this.subscriptionService.deleteSubscription(
      id,
      dto.deleteAssociatedScenes,
      dto.removeFiles
    );

    this.logger.info({ subscriptionId: id }, "Subscription deleted");
  }

  /**
   * Toggle monitoring status
   */
  async toggleMonitoring(id: string) {
    this.logger.info({ subscriptionId: id }, "Toggling subscription monitoring");

    return await this.subscriptionService.toggleMonitoring(id);
  }

  /**
   * Toggle subscription status
   */
  async toggleStatus(id: string) {
    this.logger.info({ subscriptionId: id }, "Toggling subscription status");

    return await this.subscriptionService.toggleStatus(id);
  }

  /**
   * Get scenes for subscription
   */
  async getSubscriptionScenes(id: string) {
    this.logger.info({ subscriptionId: id }, "Fetching subscription scenes");

    const subscription = await this.getById(id);

    if (subscription.entityType === "scene") {
      throw new Error("This endpoint is only for performer/studio subscriptions");
    }

    // Get scenes based on entity type
    let scenes;
    if (subscription.entityType === "performer") {
      scenes = await this.subscriptionsRepository.getPerformerScenes(subscription.entityId);
    } else {
      scenes = await this.subscriptionsRepository.getStudioScenes(subscription.entityId);
    }

    // Enrich with download status and subscription info
    const scenesWithStatus = await Promise.all(
      scenes.map(async (scene: any) => {
        const downloadQueue = await this.subscriptionsRepository.getSceneDownloadQueue(scene.id);
        const sceneSubscription = await this.subscriptionsRepository.findByEntity("scene", scene.id);

        return {
          ...scene,
          downloadStatus: downloadQueue?.status || "not_queued",
          downloadProgress: downloadQueue,
          hasFiles: scene.sceneFiles && scene.sceneFiles.length > 0,
          fileCount: scene.sceneFiles?.length || 0,
          isSubscribed: !!sceneSubscription,
          subscriptionId: sceneSubscription?.id || null,
        };
      })
    );

    return scenesWithStatus;
  }

  /**
   * Get files for scene subscription
   */
  async getSubscriptionFiles(id: string) {
    this.logger.info({ subscriptionId: id }, "Fetching subscription files");

    const subscription = await this.getById(id);

    if (subscription.entityType !== "scene") {
      throw new Error("This endpoint is only for scene subscriptions");
    }

    const files = await this.subscriptionsRepository.getSceneFiles(subscription.entityId);
    const downloadQueue = await this.subscriptionsRepository.getSceneDownloadQueue(
      subscription.entityId
    );

    // Note: Folder scanning logic delegated to controller/route for now
    // as it involves filesystem operations
    return {
      files,
      downloadQueue: downloadQueue || null,
    };
  }

  /**
   * Delete performer subscription (called by PerformersService)
   */
  async deletePerformerSubscription(
    performerId: string,
    deleteAssociatedScenes?: boolean,
    removeFiles?: boolean
  ) {
    this.logger.info({ performerId }, "Deleting performer subscription");

    const subscription = await this.subscriptionsRepository.findByEntity(
      "performer",
      performerId
    );

    if (subscription) {
      await this.delete(subscription.id, { deleteAssociatedScenes, removeFiles });
    }
  }
}
