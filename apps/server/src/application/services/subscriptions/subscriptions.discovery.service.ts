import type { Logger } from "pino";
import type { IMetadataProvider, MetadataScene } from "@/infrastructure/adapters/interfaces/metadata-provider.interface.js";
import { SubscriptionsScenesService } from "./subscriptions.scenes.service.js";
import { SubscriptionsCoreService } from "./subscriptions.core.service.js";
import type { SaveSceneDTO, LinkScenePerformersDTO } from "./subscriptions.scenes.service.js";
import { eq } from "drizzle-orm";
import { performers, studios } from "@repo/database";
import type { Database } from "@repo/database";
import { deduplicateMetadataScenes, setDeduplicatorLogger } from "@/utils/scene-deduplicator.js";

/**
 * Discovery Options
 */
export interface DiscoveryOptions {
  includeScene?: boolean;
  includeJav?: boolean;
  includeMovie?: boolean;
  autoSave?: boolean;
  autoLink?: boolean;
}

/**
 * Discovery Result
 */
export interface DiscoveryResult {
  totalFound: number;
  totalSaved: number;
  totalSkipped: number;
  allSceneIds: string[]; // All processed scene IDs (new and existing)
  errors: string[];
}

/**
 * Subscriptions Discovery Service
 * Handles scene discovery from metadata providers (TPDB/StashDB)
 * Uses IMetadataProvider adapter for external API calls
 */
export class SubscriptionsDiscoveryService {
  private metadataProvider: IMetadataProvider | undefined;
  private subscriptionsScenesService: SubscriptionsScenesService;
  private subscriptionsCoreService: SubscriptionsCoreService;
  private db: Database;
  private logger: Logger;

  constructor({
    metadataProvider,
    subscriptionsScenesService,
    subscriptionsCoreService,
    db,
    logger,
  }: {
    metadataProvider: IMetadataProvider | undefined;
    subscriptionsScenesService: SubscriptionsScenesService;
    subscriptionsCoreService: SubscriptionsCoreService;
    db: Database;
    logger: Logger;
  }) {
    this.metadataProvider = metadataProvider;
    this.subscriptionsScenesService = subscriptionsScenesService;
    this.subscriptionsCoreService = subscriptionsCoreService;
    this.db = db;
    this.logger = logger;
    // Set logger for deduplicator utility
    setDeduplicatorLogger(logger);
  }

  /**
   * Discover and save scenes for a performer subscription
   */
  async discoverScenesForPerformer(
    performerId: string,
    options: DiscoveryOptions = {}
  ): Promise<DiscoveryResult> {
    this.logger.info({ performerId, options }, "Starting scene discovery for performer");

    if (!this.metadataProvider) {
      this.logger.warn("No metadata provider configured");
      return { totalFound: 0, totalSaved: 0, totalSkipped: 0, allSceneIds: [], errors: ["No metadata provider"] };
    }

    const result: DiscoveryResult = {
      totalFound: 0,
      totalSaved: 0,
      totalSkipped: 0,
      allSceneIds: [],
      errors: [],
    };

    try {
      // Get performer's TPDB/StashDB ID
      const tpdbId = await this.getTpdbIdForEntity("performer", performerId);
      if (!tpdbId) {
        this.logger.info({ performerId }, "No external ID found for performer");
        return result;
      }

      this.logger.info({ performerId, tpdbId }, "Fetching scenes from metadata provider");

      // Fetch scenes from all content types
      const contentTypes = this.getContentTypes(options);
      const allScenes: any[] = [];

      for (const contentType of contentTypes) {
        let scenesResponse: { scenes: unknown[]; pagination?: { total: number } } | null = null;
        try {
          this.logger.info({ contentType, tpdbId }, `Fetching ${contentType} scenes`);

          let page = 1;
          let hasMore = true;

          while (hasMore) {
            scenesResponse = this.metadataProvider.getPerformerScenes
              ? await this.metadataProvider.getPerformerScenes(tpdbId, contentType, page)
              : null;

            if (!scenesResponse || !scenesResponse.scenes || scenesResponse.scenes.length === 0) {
              hasMore = false;
            } else {
              allScenes.push(...scenesResponse.scenes);
              result.totalFound += scenesResponse.scenes.length;

              // Check pagination
              if (scenesResponse.pagination && scenesResponse.pagination.total !== undefined) {
                const pageSize = 25;
                const expectedPages = Math.ceil(scenesResponse.pagination.total / pageSize);
                hasMore = page < expectedPages;
              } else {
                // Fallback: stop if page wasn't full
                hasMore = scenesResponse.scenes.length >= 25;
              }

              page++;
            }
          }

          this.logger.info({ contentType, count: scenesResponse?.scenes?.length || 0 }, "Fetched scenes");
        } catch (error) {
          const errorMsg = `Failed to fetch ${contentType} scenes`;
          this.logger.error({ error }, errorMsg);
          result.errors.push(errorMsg);
        }
      }

      // Deduplicate scenes using the scene-deduplicator utility
      // This applies:
      // - Duration filtering (removes trailers < 60 seconds)
      // - Hash-based deduplication (ohash/phash)
      // - Performer + Date combination deduplication
      // - JAV code pattern matching
      this.logger.info({ totalScenes: allScenes.length }, "Starting scene deduplication");

      // Log sample scene data to debug structure
      if (allScenes.length > 0) {
        const sample = allScenes[0] as any;
        this.logger.info({
          sampleScene: {
            id: sample.id,
            title: sample.title,
            contentType: sample.contentType,
            duration: sample.duration,
            hasHashes: !!sample.hashes,
            hashesCount: sample.hashes?.length || 0,
            hasPerformers: !!sample.performers,
            performersCount: sample.performers?.length || 0,
            performersStructure: sample.performers?.[0] ? JSON.stringify(sample.performers[0]).slice(0, 100) : 'none',
          }
        }, "Sample scene structure from TPDB");
      }

      const uniqueScenes = deduplicateMetadataScenes(allScenes as MetadataScene[]);
      const duplicateCount = allScenes.length - uniqueScenes.length;
      result.totalFound = uniqueScenes.length;

      this.logger.info(
        {
          total: allScenes.length,
          unique: uniqueScenes.length,
          duplicates: duplicateCount
        },
        "Scene deduplication complete"
      );

      // Save and link scenes
      if (options.autoSave !== false) {
        for (const scene of uniqueScenes) {
          try {
            const sceneId = await this.saveSceneFromMetadata(scene, "performer", performerId);
            if (sceneId) {
              result.totalSaved++;
              // Track all processed scene IDs (both new and existing)
              result.allSceneIds.push(sceneId);

              if (options.autoLink !== false) {
                await this.subscriptionsScenesService.linkScenePerformers({
                  sceneId,
                  entityType: "performer",
                  entityId: performerId,
                  performers: scene.performers,
                });
              }
            } else {
              result.totalSkipped++;
            }
          } catch (error) {
            this.logger.error({ error, scene: scene.title }, "Failed to save scene");
            result.errors.push(`Failed to save scene: ${scene.title}`);
          }
        }
      }

      this.logger.info(
        {
          performerId,
          totalFound: result.totalFound,
          totalSaved: result.totalSaved,
          totalSkipped: result.totalSkipped,
        },
        "Performer scene discovery complete"
      );

      return result;
    } catch (error) {
      this.logger.error({ error, performerId }, "Failed to discover scenes for performer");
      result.errors.push("Discovery failed: " + (error as Error).message);
      return result;
    }
  }

  /**
   * Discover and save scenes for a studio subscription
   */
  async discoverScenesForStudio(
    studioId: string,
    options: DiscoveryOptions = {}
  ): Promise<DiscoveryResult> {
    this.logger.info({ studioId, options }, "Starting scene discovery for studio");

    // Note: TPDB doesn't have getSiteScenes, so we skip for now
    // This can be implemented later when StashDB or other providers support it

    this.logger.info({ studioId }, "Studio scene discovery not yet implemented for TPDB");
    return {
      totalFound: 0,
      totalSaved: 0,
      totalSkipped: 0,
      allSceneIds: [],
      errors: ["Studio scene discovery not yet implemented"],
    };
  }

  /**
   * Discover a single scene by external ID
   */
  async discoverSceneById(sceneId: string): Promise<any | null> {
    this.logger.info({ sceneId }, "Discovering scene by ID");

    if (!this.metadataProvider) {
      this.logger.warn("No metadata provider configured");
      return null;
    }

    try {
      const scene = await this.metadataProvider.getSceneById(sceneId);
      return scene;
    } catch (error) {
      this.logger.error({ error, sceneId }, "Failed to discover scene");
      return null;
    }
  }

  /**
   * Search for scenes by query
   */
  async searchScenes(query: string, _options: DiscoveryOptions = {}): Promise<any[]> {
    this.logger.info({ query }, "Searching for scenes");

    if (!this.metadataProvider) {
      this.logger.warn("No metadata provider configured");
      return [];
    }

    try {
      const scenes = await this.metadataProvider.searchScenes(query);
      return scenes;
    } catch (error) {
      this.logger.error({ error, query }, "Failed to search scenes");
      return [];
    }
  }

  /**
   * Sync scenes for an existing subscription
   */
  async syncScenesForSubscription(subscriptionId: string): Promise<DiscoveryResult> {
    this.logger.info({ subscriptionId }, "Syncing scenes for subscription");

    const subscription = await this.subscriptionsCoreService.getById(subscriptionId);

    if (subscription.entityType === "performer") {
      return await this.discoverScenesForPerformer(subscription.entityId, {
        autoSave: true,
        autoLink: true,
      });
    } else if (subscription.entityType === "studio") {
      return await this.discoverScenesForStudio(subscription.entityId, {
        autoSave: true,
        autoLink: true,
      });
    } else {
      return {
        totalFound: 0,
        totalSaved: 0,
        totalSkipped: 0,
        allSceneIds: [],
        errors: ["Scene subscriptions don't have scenes to sync"],
      };
    }
  }

  /**
   * Get TPDB/StashDB ID for entity
   */
  private async getTpdbIdForEntity(
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<string | null> {
    if (entityType === "performer") {
      const performer = await this.db.query.performers.findFirst({
        where: eq(performers.id, entityId),
      });
      // Use externalIds array to find TPDB ID
      return performer?.externalIds?.find((e) => e.source === "tpdb")?.id || null;
    } else {
      const studio = await this.db.query.studios.findFirst({
        where: eq(studios.id, entityId),
      });
      // Use externalIds array to find TPDB ID
      return studio?.externalIds?.find((e) => e.source === "tpdb")?.id || null;
    }
  }

  /**
   * Save scene from metadata
   */
  private async saveSceneFromMetadata(
    tpdbScene: any,
    _entityType: "performer" | "studio",
    _entityId: string
  ): Promise<string | null> {
    return await this.subscriptionsScenesService.saveSceneFromMetadata({
      externalId: tpdbScene.id,
      source: "tpdb",
      title: tpdbScene.title,
      date: tpdbScene.date,
      contentType: tpdbScene.contentType,
      code: tpdbScene.code,
      slug: tpdbScene.slug,
      duration: tpdbScene.duration,
      images: tpdbScene.images,
      poster: tpdbScene.poster,
      backImage: tpdbScene.back_image,
      thumbnail: tpdbScene.thumbnail,
      background: tpdbScene.background,
      description: tpdbScene.description,
      studioTpdbData: tpdbScene.studio,
    });
  }

  /**
   * Get content types to fetch based on options
   */
  private getContentTypes(options: DiscoveryOptions): Array<"scene" | "jav" | "movie"> {
    const types: Array<"scene" | "jav" | "movie"> = [];

    if (options.includeScene !== false) types.push("scene");
    if (options.includeJav !== false) types.push("jav");
    if (options.includeMovie !== false) types.push("movie");

    // Default to all if none specified
    if (types.length === 0) {
      types.push("scene", "jav", "movie");
    }

    return types;
  }
}
