import type { Logger } from "pino";
import { SubscriptionsRepository } from "@/infrastructure/repositories/subscriptions.repository.js";
import { nanoid } from "nanoid";

/**
 * DTOs for Subscriptions Core Service
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
  isSubscribed?: boolean;
  searchCutoffDate?: string | null;
}

export interface DeleteSubscriptionDTO {
  deleteAssociatedScenes?: boolean;
  removeFiles?: boolean;
}

export interface SubscriptionFilters {
  search?: string;
  includeMetaless?: boolean;
  showInactive?: boolean;
}

/**
 * Subscriptions Core Service
 * Business logic for basic subscription CRUD operations
 * Pure business logic - no external API calls
 */
export class SubscriptionsCoreService {
  private subscriptionsRepository: SubscriptionsRepository;
  private logger: Logger;

  constructor({
    subscriptionsRepository,
    logger,
  }: {
    subscriptionsRepository: SubscriptionsRepository;
    logger: Logger;
  }) {
    this.subscriptionsRepository = subscriptionsRepository;
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
   * Get subscriptions by type
   */
  async getByType(entityType: string) {
    this.logger.info({ entityType }, "Fetching subscriptions by type");
    return await this.subscriptionsRepository.findByType(entityType as "performer" | "studio" | "scene");
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
   * Get subscription with details (entity + quality profile)
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
      entityType as "performer" | "studio" | "scene",
      entityId
    );

    return {
      subscribed: !!subscription,
      subscription: subscription || null,
    };
  }

  /**
   * Create subscription with basic validation
   * Note: Complex creation logic (entity resolution, scene fetching) delegated to discovery service
   */
  async createBasic(dto: CreateSubscriptionDTO) {
    this.logger.info({ entityType: dto.entityType, entityId: dto.entityId }, "Creating basic subscription");

    // Check for duplicates
    const existing = await this.subscriptionsRepository.findByEntity(dto.entityType, dto.entityId);
    if (existing) {
      throw new Error("Subscription already exists for this entity");
    }

    // Create subscription
    const now = new Date().toISOString();
    const subscription = {
      id: nanoid(),
      entityType: dto.entityType,
      entityId: dto.entityId,
      qualityProfileId: dto.qualityProfileId,
      autoDownload: dto.autoDownload,
      includeMetadataMissing: dto.includeMetadataMissing,
      includeAliases: dto.includeAliases,
      isSubscribed: true,
      searchCutoffDate: null as string | null,
      createdAt: now,
      updatedAt: now,
    };

    await this.subscriptionsRepository.create(subscription);
    this.logger.info({ subscriptionId: subscription.id }, "Basic subscription created");

    return subscription;
  }

  /**
   * Update subscription
   * When unsubscribing from performer/studio, also unsubscribe related scene subscriptions
   */
  async update(id: string, dto: UpdateSubscriptionDTO) {
    this.logger.info({ subscriptionId: id }, "Updating subscription");

    // Check if exists
    const exists = await this.subscriptionsRepository.exists(id);
    if (!exists) {
      throw new Error("Subscription not found");
    }

    // Get current subscription before update
    const current = await this.subscriptionsRepository.findById(id);

    // Build update data (only include provided fields)
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (dto.qualityProfileId !== undefined) {
      updateData.qualityProfileId = dto.qualityProfileId;
    }
    if (dto.autoDownload !== undefined) {
      updateData.autoDownload = dto.autoDownload;
    }
    if (dto.includeMetadataMissing !== undefined) {
      updateData.includeMetadataMissing = dto.includeMetadataMissing;
    }
    if (dto.includeAliases !== undefined) {
      updateData.includeAliases = dto.includeAliases;
    }
    if (dto.isSubscribed !== undefined) {
      updateData.isSubscribed = dto.isSubscribed;
    }
    if (dto.searchCutoffDate !== undefined) {
      updateData.searchCutoffDate = dto.searchCutoffDate;
    }

    const updated = await this.subscriptionsRepository.update(id, updateData);
    this.logger.info({ subscriptionId: id }, "Subscription updated");

    // If unsubscribing from performer/studio, cascade to scene subscriptions
    if (dto.isSubscribed === false && (current.entityType === "performer" || current.entityType === "studio")) {
      await this.cascadeUnsubscribeToScenes(current);
    }

    return updated;
  }

  /**
   * Delete subscription
   * Note: Cascade deletion logic (scenes, files) delegated to management service
   */
  async deleteBasic(id: string) {
    this.logger.info({ subscriptionId: id }, "Deleting basic subscription");

    // Check if exists
    const exists = await this.subscriptionsRepository.exists(id);
    if (!exists) {
      throw new Error("Subscription not found");
    }

    await this.subscriptionsRepository.delete(id);
    this.logger.info({ subscriptionId: id }, "Basic subscription deleted");

    return { success: true };
  }

  /**
   * Toggle subscription status (active <-> inactive)
   */
  async toggleStatus(id: string) {
    this.logger.info({ subscriptionId: id }, "Toggling subscription status");

    const subscription = await this.getById(id);
    const newStatus = !subscription.isSubscribed;
    const updated = await this.subscriptionsRepository.update(id, {
      isSubscribed: newStatus,
      updatedAt: new Date().toISOString(),
    });

    this.logger.info({
      subscriptionId: id,
      newStatus,
    }, "Subscription status toggled");

    return updated;
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
          subscriptionId: sceneSubscription?.id || null,
          isSubscribed: sceneSubscription?.isSubscribed ?? false,
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

    return {
      files,
      downloadQueue: downloadQueue || null,
    };
  }
}
