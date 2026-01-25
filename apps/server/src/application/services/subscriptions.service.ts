import { nanoid } from "nanoid";
import type { Logger } from "pino";
import { SubscriptionsRepository } from "@/infrastructure/repositories/subscriptions.repository.js";
import { ScenesRepository } from "@/infrastructure/repositories/scenes.repository.js";
import { SubscriptionsCoreService } from "./subscriptions/subscriptions.core.service.js";
import { SubscriptionsScenesService } from "./subscriptions/subscriptions.scenes.service.js";
import { SubscriptionsDiscoveryService } from "./subscriptions/subscriptions.discovery.service.js";
import { EntityResolverService } from "@/application/services/entity-resolver/entity-resolver.service.js";
import { FileManagerService } from "@/application/services/file-management/file-manager.service.js";

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
 * Subscriptions Service (Clean Architecture)
 * Business logic for subscription management
 * Orchestrates the modular subscription services
 */
export class SubscriptionsService {
  private subscriptionsRepository: SubscriptionsRepository;
  private scenesRepository: ScenesRepository;
  private subscriptionsCoreService: SubscriptionsCoreService;
  private subscriptionsScenesService: SubscriptionsScenesService;
  private subscriptionsDiscoveryService: SubscriptionsDiscoveryService;
  private entityResolverService: EntityResolverService;
  private fileManager: FileManagerService;
  private logger: Logger;

  constructor({
    subscriptionsRepository,
    scenesRepository,
    subscriptionsCoreService,
    subscriptionsScenesService,
    subscriptionsDiscoveryService,
    entityResolverService,
    fileManager,
    logger,
  }: {
    subscriptionsRepository: SubscriptionsRepository;
    scenesRepository: ScenesRepository;
    subscriptionsCoreService: SubscriptionsCoreService;
    subscriptionsScenesService: SubscriptionsScenesService;
    subscriptionsDiscoveryService: SubscriptionsDiscoveryService;
    entityResolverService: EntityResolverService;
    fileManager: FileManagerService;
    logger: Logger;
  }) {
    this.subscriptionsRepository = subscriptionsRepository;
    this.scenesRepository = scenesRepository;
    this.subscriptionsCoreService = subscriptionsCoreService;
    this.subscriptionsScenesService = subscriptionsScenesService;
    this.subscriptionsDiscoveryService = subscriptionsDiscoveryService;
    this.entityResolverService = entityResolverService;
    this.fileManager = fileManager;
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
   * Uses repository method that handles joins
   */
  async getAllWithDetails(filters?: SubscriptionFilters) {
    this.logger.info({ filters }, "Fetching all subscriptions with details");
    const subscriptions = await this.subscriptionsRepository.findAllWithDetails(filters);

    // Add entityName to each subscription
    return subscriptions.map((sub: any) => {
      let entityName = "Unknown";

      if (sub.entity) {
        const entity = sub.entity;
        if (sub.entityType === "performer" || sub.entityType === "studio") {
          entityName = entity.name;
        } else if (sub.entityType === "scene") {
          entityName = entity.title;
        }
      }

      if (!entityName || entityName === "Unknown") {
        entityName = sub.entityId;
      }

      return {
        ...sub,
        entityName,
      };
    });
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
      entityType as "performer" | "studio" | "scene",
      entityId
    );

    return {
      subscribed: !!subscription,
      subscription: subscription || null,
    };
  }

  /**
   * Create subscription
   * Uses SubscriptionsCoreService for basic CRUD
   * For performer/studio subscriptions, also subscribes to related scenes
   */
  async create(dto: CreateSubscriptionDTO) {
    this.logger.info({ entityType: dto.entityType, entityId: dto.entityId }, "Creating subscription");

    // Resolve external entity ID to local entity ID
    // This creates the entity in local DB if it doesn't exist
    const localEntityId = await this.entityResolverService.resolveEntity(
      dto.entityType,
      dto.entityId
    );

    if (!localEntityId) {
      throw new Error(
        `${dto.entityType} with ID ${dto.entityId} not found and could not be fetched from external sources`
      );
    }

    // Use core service for basic creation with local ID
    const subscription = await this.subscriptionsCoreService.createBasic({
      ...dto,
      entityId: localEntityId,
    });

    // If subscribing to a performer or studio, also subscribe to all their scenes
    if (dto.entityType === "performer" || dto.entityType === "studio") {
      // Studio subscriptions should not include aliases
      const includeAliases = dto.entityType === "studio" ? false : dto.includeAliases;
      await this.subscribeToEntityScenes(
        dto.entityType,
        localEntityId,
        dto.qualityProfileId,
        dto.autoDownload,
        dto.includeMetadataMissing,
        includeAliases
      );
    } else if (dto.entityType === "scene") {
      this.logger.info({ sceneId: localEntityId }, "Scene subscription created");
    }

    // Add entityName to response (from repository)
    const entityName = await this.subscriptionsRepository.getEntityName(dto.entityType, localEntityId);

    return {
      ...subscription,
      entityName,
    };
  }

  /**
   * Subscribe to all scenes of a performer or studio
   * If scenes don't exist in DB, fetches them from metadata provider first
   */
  private async subscribeToEntityScenes(
    entityType: "performer" | "studio",
    entityId: string,
    qualityProfileId: string,
    autoDownload: boolean,
    includeMetadataMissing: boolean,
    includeAliases: boolean
  ): Promise<void> {
    this.logger.info(
      { entityType, entityId },
      "Starting to subscribe to scenes"
    );

    // ALWAYS discover from metadata provider to get latest scenes and apply deduplication
    // Returns ALL scene IDs (both new and existing)
    let allSceneIds: string[] = [];
    if (entityType === "performer") {
      this.logger.info({ entityId }, "Discovering scenes from metadata provider");

      const discoveryResult = await this.subscriptionsDiscoveryService.discoverScenesForPerformer(entityId, {
        autoSave: true, // Save new scenes
        autoLink: true,
      });

      allSceneIds = discoveryResult.allSceneIds;

      this.logger.info({
        totalFound: discoveryResult.totalFound,
        totalSaved: discoveryResult.totalSaved,
        totalSkipped: discoveryResult.totalSkipped,
        allScenes: allSceneIds.length,
      }, "Scene discovery complete");
    }

    // Subscribe to ALL scenes (new and existing)
    let subscribedCount = 0;
    let folderCreatedCount = 0;

    for (const sceneId of allSceneIds) {
      // Get scene details
      const scene = await this.scenesRepository.findById(sceneId);

      if (!scene) continue;

      // Check if scene subscription already exists
      const existing = await this.subscriptionsRepository.findByEntity("scene", scene.id);
      if (existing) {
        this.logger.debug({ sceneId: scene.id }, "Scene already subscribed");
        continue;
      }

      // Create scene subscription
      await this.subscriptionsCoreService.createBasic({
        entityType: "scene",
        entityId: scene.id,
        qualityProfileId,
        autoDownload,
        includeMetadataMissing,
        includeAliases,
      });

      subscribedCount++;

      // Create folder structure with poster and NFO for the scene
      try {
        this.logger.info({ sceneId: scene.id, title: scene.title }, "Creating scene folder");

        // Create the scene folder
        const folderPath = await this.fileManager.createSceneFolder(scene.id);

        // Download poster
        await this.fileManager.downloadPoster(scene.id, folderPath);

        // Generate NFO file
        await this.fileManager.generateNFO(scene.id, folderPath);

        this.logger.info({ sceneId: scene.id, folderPath }, "Scene folder created with poster and NFO");
        folderCreatedCount++;
      } catch (error) {
        this.logger.error({ sceneId: scene.id, error }, "Failed to create scene folder");
        // Don't fail the subscription if folder creation fails
      }
    }

    this.logger.info(
      { entityType, entityId, subscribedCount, folderCreatedCount },
      "Scene subscriptions created"
    );
  }

  /**
   * Update subscription
   * Uses SubscriptionsCoreService for updates
   */
  async update(id: string, dto: UpdateSubscriptionDTO) {
    this.logger.info({ subscriptionId: id }, "Updating subscription");

    // Use core service for update
    return await this.subscriptionsCoreService.update(id, dto);
  }

  /**
   * Delete subscription
   * Uses SubscriptionsCoreService for deletion
   * Cascade delete for scenes if requested
   *
   * Scene deletion logic:
   * - If scene has relations (performer/studio), soft delete (isSubscribed=false)
   * - If scene has NO relations, hard delete from DB
   * - Scene folders are always deleted when removeFiles=true
   */
  async delete(id: string, dto: DeleteSubscriptionDTO) {
    this.logger.info({ subscriptionId: id, ...dto }, "Deleting subscription");

    // Get subscription first to check type
    const subscription = await this.subscriptionsCoreService.getById(id);

    // If this is a scene subscription and removeFiles is requested, delete folder first
    if (subscription.entityType === "scene" && dto.removeFiles) {
      try {
        await this.fileManager.deleteSceneFolder(subscription.entityId, "user_deleted");
        this.logger.info({ sceneId: subscription.entityId }, "Scene folder deleted");
      } catch (error) {
        this.logger.error({ sceneId: subscription.entityId, error }, "Failed to delete scene folder");
      }
    }

    // If deleteAssociatedScenes is true and this is performer/studio
    if (dto.deleteAssociatedScenes && (subscription.entityType === "performer" || subscription.entityType === "studio")) {
      // Get scenes for this subscription
      const scenes = subscription.entityType === "performer"
        ? await this.subscriptionsRepository.getPerformerScenes(subscription.entityId)
        : await this.subscriptionsRepository.getStudioScenes(subscription.entityId);

      this.logger.info({ sceneCount: scenes.length }, "Processing scene deletions");

      // Process each scene
      for (const scene of scenes as any[]) {
        // Delete scene subscription first
        const sceneSub = await this.subscriptionsRepository.findByEntity("scene", scene.id);
        if (sceneSub) {
          await this.subscriptionsCoreService.deleteBasic(sceneSub.id);
        }

        // Check if scene has other relations (performers or studio)
        const relations = await this.subscriptionsRepository.getSceneRelationsCount(scene.id);
        const hasRelations = relations.performers > 0 || relations.studios > 0;

        if (hasRelations) {
          // Soft delete: set isSubscribed=false
          // Scene stays in DB for potential re-subscription
          this.logger.info({
            sceneId: scene.id,
            title: scene.title,
            relations,
          }, "Scene has relations - soft deleting (isSubscribed=false)");
          await this.subscriptionsRepository.updateSceneIsSubscribed(scene.id, false);
        } else {
          // Hard delete: remove from DB completely
          this.logger.info({
            sceneId: scene.id,
            title: scene.title,
          }, "Scene has no relations - hard deleting from DB");
          await this.subscriptionsRepository.deleteScene(scene.id);
        }

        // Delete scene folder if requested
        if (dto.removeFiles) {
          try {
            await this.fileManager.deleteSceneFolder(scene.id, "user_deleted");
            this.logger.info({ sceneId: scene.id }, "Scene folder deleted");
          } catch (error) {
            this.logger.error({ sceneId: scene.id, error }, "Failed to delete scene folder");
          }
        }
      }
    }

    // Delete the subscription
    await this.subscriptionsCoreService.deleteBasic(id);

    this.logger.info({ subscriptionId: id }, "Subscription deleted");
  }

  /**
   * Toggle subscription status (active <-> inactive)
   * Uses SubscriptionsCoreService
   */
  async toggleStatus(id: string) {
    this.logger.info({ subscriptionId: id }, "Toggling subscription status");

    return await this.subscriptionsCoreService.toggleStatus(id);
  }

  /**
   * Get scenes for subscription
   * Uses repository methods with join logic
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
   * Uses repository methods
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
