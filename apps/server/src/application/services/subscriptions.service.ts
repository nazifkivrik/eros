import { nanoid } from "nanoid";
import type { Logger } from "pino";
import type { TorrentClientRegistry } from "@/infrastructure/registries/provider-registry.js";
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
  private torrentClientRegistry: TorrentClientRegistry;
  private logger: Logger;

  constructor({
    subscriptionsRepository,
    scenesRepository,
    subscriptionsCoreService,
    subscriptionsScenesService,
    subscriptionsDiscoveryService,
    entityResolverService,
    fileManager,
    torrentClientRegistry,
    logger,
  }: {
    subscriptionsRepository: SubscriptionsRepository;
    scenesRepository: ScenesRepository;
    subscriptionsCoreService: SubscriptionsCoreService;
    subscriptionsScenesService: SubscriptionsScenesService;
    subscriptionsDiscoveryService: SubscriptionsDiscoveryService;
    entityResolverService: EntityResolverService;
    fileManager: FileManagerService;
    torrentClientRegistry: TorrentClientRegistry;
    logger: Logger;
  }) {
    this.subscriptionsRepository = subscriptionsRepository;
    this.scenesRepository = scenesRepository;
    this.subscriptionsCoreService = subscriptionsCoreService;
    this.subscriptionsScenesService = subscriptionsScenesService;
    this.subscriptionsDiscoveryService = subscriptionsDiscoveryService;
    this.entityResolverService = entityResolverService;
    this.fileManager = fileManager;
    this.torrentClientRegistry = torrentClientRegistry;
    this.logger = logger;
  }

  /**
   * Get the primary torrent client
   */
  private getTorrentClient() {
    const primary = this.torrentClientRegistry.getPrimary();
    return primary?.provider;
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
   * - Scene subscriptions: always soft delete (isSubscribed=false), never delete scene from DB
   * - Performer/studio subscriptions with deleteAssociatedScenes=true:
   *   - Delete performer/studio from DB
   *   - Delete performersScenes junction table entries
   *   - Delete scene subscriptions, torrents, and folders
   *   - If scene has NO other relations → hard delete from DB
   * - Performer/studio subscriptions with deleteAssociatedScenes=false:
   *   - Only delete the subscription, keep all scenes
   */
  async delete(id: string, dto: DeleteSubscriptionDTO) {
    this.logger.info({ subscriptionId: id, ...dto }, "Deleting subscription");

    // Get subscription first to check type
    const subscription = await this.subscriptionsCoreService.getById(id);

    // Case 3: Scene subscription deletion
    if (subscription.entityType === "scene") {
      // Delete scene folder if requested
      if (dto.removeFiles) {
        try {
          await this.fileManager.deleteSceneFolder(subscription.entityId, "user_deleted");
          this.logger.info({ sceneId: subscription.entityId }, "Scene folder deleted");
        } catch (error) {
          this.logger.error({ sceneId: subscription.entityId, error }, "Failed to delete scene folder");
        }
      }

      // Soft delete: mark scene as unsubscribed, don't delete from DB
      await this.subscriptionsRepository.updateSceneIsSubscribed(subscription.entityId, false);

      // Delete the scene subscription
      await this.subscriptionsCoreService.deleteBasic(id);

      this.logger.info({ subscriptionId: id }, "Scene subscription deleted");
      return;
    }

    // Case 1: Delete performer/studio with all scenes and the entity itself
    if (dto.deleteAssociatedScenes && (subscription.entityType === "performer" || subscription.entityType === "studio")) {
      const entityType = subscription.entityType;
      const entityId = subscription.entityId;

      // Get scenes for this subscription BEFORE deleting relations
      const scenes = entityType === "performer"
        ? await this.subscriptionsRepository.getPerformerScenes(entityId)
        : await this.subscriptionsRepository.getStudioScenes(entityId);

      this.logger.info({ entityType, entityId, sceneCount: scenes.length }, "Processing full deletion with scenes");

      // Step 1: Delete junction table entries (performersScenes)
      // This must happen BEFORE processing scenes so hasOtherRelations check works correctly
      if (entityType === "performer") {
        try {
          await this.subscriptionsRepository.deletePerformerScenes(entityId);
          this.logger.info({ performerId: entityId }, "Deleted performer-scene relations");
        } catch (error) {
          this.logger.error({ performerId: entityId, error }, "Failed to delete performer-scene relations");
        }
      }

      // Step 2: Process each scene
      for (const scene of scenes as any[]) {
        // 2a. Delete scene subscription
        const sceneSub = await this.subscriptionsRepository.findByEntity("scene", scene.id);
        if (sceneSub) {
          await this.subscriptionsCoreService.deleteBasic(sceneSub.id);
        }

        // 2b. Delete torrent from qBittorrent
        const downloadQueue = await this.subscriptionsRepository.getSceneDownloadQueue(scene.id);
        const torrentClient = this.getTorrentClient();
        if (downloadQueue?.qbitHash && torrentClient) {
          try {
            await torrentClient.removeTorrent(downloadQueue.qbitHash, false);
            this.logger.info({ sceneId: scene.id, torrentHash: downloadQueue.qbitHash }, "Torrent deleted from qBittorrent");
          } catch (error) {
            this.logger.error({ sceneId: scene.id, error }, "Failed to delete torrent from qBittorrent");
          }
        }

        // 2c. Delete scene folder if requested
        if (dto.removeFiles) {
          try {
            await this.fileManager.deleteSceneFolder(scene.id, "user_deleted");
            this.logger.info({ sceneId: scene.id }, "Scene folder deleted");
          } catch (error) {
            this.logger.error({ sceneId: scene.id, error }, "Failed to delete scene folder");
          }
        }

        // 2d. Check if scene has other active subscriptions (not just relations)
        // We only care if there are other SUBSCRIBED performers/studios
        const hasOtherSubscriptions = await this.checkSceneHasOtherSubscriptions(scene.id, entityType, entityId);

        // 2e. Hard delete only scenes WITHOUT other active subscriptions
        if (!hasOtherSubscriptions) {
          // Scene has no other active subscriptions - hard delete from DB
          this.logger.info({
            sceneId: scene.id,
            title: scene.title,
          }, "Scene has no other active subscriptions - hard deleting from DB");
          await this.subscriptionsRepository.deleteScene(scene.id);
        } else {
          // Scene has other active subscriptions - keep scene untouched
          this.logger.info({
            sceneId: scene.id,
            title: scene.title,
          }, "Scene has other active subscriptions - keeping scene in DB");
        }
      }

      // Step 3: Delete the subscription itself (performer/studio stays in DB)
      await this.subscriptionsCoreService.deleteBasic(id);

      this.logger.info({ subscriptionId: id, entityType, entityId }, "Subscription deleted with scenes, performer/studio kept in DB");
      return;
    }

    // Case 2: Delete the subscription only, keep all scenes
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
   * Check if a scene has other active subscriptions (excluding the current one)
   * This is used when deleting a performer/studio subscription to determine if scenes should be deleted
   */
  private async checkSceneHasOtherSubscriptions(
    sceneId: string,
    currentEntityType: "performer" | "studio",
    currentEntityId: string
  ): Promise<boolean> {
    // 1. Check if scene has its own active subscription
    const sceneSub = await this.subscriptionsRepository.findByEntity("scene", sceneId);
    if (sceneSub && sceneSub.isSubscribed) {
      this.logger.debug({ sceneId }, "Scene has its own active subscription");
      return true;
    }

    // 2. Get all performers for this scene from junction table
    const performerIds = await this.subscriptionsRepository.getScenePerformerIds(sceneId);

    // 3. Check if any of the scene's performers have active subscriptions
    for (const performerId of performerIds) {
      // Skip the current performer being deleted
      if (currentEntityType === "performer" && performerId === currentEntityId) {
        continue;
      }
      const perfSub = await this.subscriptionsRepository.findByEntity("performer", performerId);
      if (perfSub && perfSub.isSubscribed) {
        this.logger.debug({ sceneId, performerId }, "Scene has performer with active subscription");
        return true;
      }
    }

    // 4. Check if scene's studio has active subscription
    const scene = await this.scenesRepository.findById(sceneId);
    if (scene?.siteId) {
      // Skip the current studio being deleted
      if (currentEntityType !== "studio" || scene.siteId !== currentEntityId) {
        const studioSub = await this.subscriptionsRepository.findByEntity("studio", scene.siteId);
        if (studioSub && studioSub.isSubscribed) {
          this.logger.debug({ sceneId, studioId: scene.siteId }, "Scene has studio with active subscription");
          return true;
        }
      }
    }

    return false;
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
