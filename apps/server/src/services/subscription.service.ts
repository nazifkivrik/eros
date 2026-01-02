/**
 * Subscription Service
 * Handles creating and managing subscriptions for performers, studios, and scenes
 */

import { eq, and } from "drizzle-orm";
import type { Database } from "@repo/database";
import {
  subscriptions,
  performers,
  studios,
  scenes,
  qualityProfiles,
  performersScenes,
  sceneFiles,
  downloadQueue,
} from "@repo/database";
import { nanoid } from "nanoid";
import type { TPDBService } from "./tpdb/tpdb.service.js";
import { EntityResolverService } from "./entity-resolver.service.js";
import { logger } from "../utils/logger.js";

interface CreateSubscriptionInput {
  entityType: "performer" | "studio" | "scene";
  entityId: string;
  qualityProfileId: string;
  autoDownload: boolean;
  includeMetadataMissing: boolean;
  includeAliases: boolean;
}

interface Subscription {
  id: string;
  entityType: string;
  entityId: string;
  qualityProfileId: string;
  autoDownload: boolean;
  includeMetadataMissing: boolean;
  includeAliases: boolean;
  status: string;
  monitored: boolean;
  searchCutoffDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export class SubscriptionService {
  private entityResolver: EntityResolverService;

  constructor(
    private db: Database,
    private tpdb?: TPDBService
  ) {
    this.entityResolver = new EntityResolverService(db, tpdb);
  }

  /**
   * Get local entity ID - checks local database first, then fetches from TPDB if available
   * Delegates to EntityResolverService to eliminate code duplication
   */
  private async getLocalEntityId(
    entityType: string,
    entityId: string
  ): Promise<string | null> {
    return this.entityResolver.resolveEntity(
      entityType as "performer" | "studio" | "scene",
      entityId
    );
  }

  /**
   * Create a new subscription
   * When subscribing to a performer or studio, also subscribe to all their scenes
   */
  async createSubscription(
    input: CreateSubscriptionInput
  ): Promise<Subscription> {
    const now = new Date().toISOString();

    // Convert entityId to local ID if it's a StashDB ID
    const localEntityId = await this.getLocalEntityId(
      input.entityType,
      input.entityId
    );

    if (!localEntityId) {
      logger.error(
        `[SubscriptionService] Entity not found: ${input.entityType} with ID ${input.entityId}`
      );
      throw new Error(
        `${input.entityType} with ID ${input.entityId} not found`
      );
    }

    // Get entity name for logging
    let entityName = "Unknown";
    if (input.entityType === "performer") {
      const performer = await this.db.query.performers.findFirst({
        where: eq(performers.id, localEntityId),
      });
      entityName = performer?.name || localEntityId;
    } else if (input.entityType === "studio") {
      const studio = await this.db.query.studios.findFirst({
        where: eq(studios.id, localEntityId),
      });
      entityName = studio?.name || localEntityId;
    } else if (input.entityType === "scene") {
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, localEntityId),
      });
      entityName = scene?.title || localEntityId;
    }

    logger.info(
      `[SubscriptionService] Creating subscription for ${input.entityType}: ${entityName}`
    );

    // Check if subscription already exists using local ID
    const existing = await this.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.entityType, input.entityType),
        eq(subscriptions.entityId, localEntityId)
      ),
    });

    if (existing) {
      logger.warn(
        `[SubscriptionService] Subscription already exists for ${input.entityType}: ${entityName} (subscription ID: ${existing.id})`
      );
      throw new Error(`Subscription for ${entityName} already exists`);
    }

    const subscription = {
      id: nanoid(),
      entityType: input.entityType,
      entityId: localEntityId, // Always use local ID
      qualityProfileId: input.qualityProfileId,
      autoDownload: input.autoDownload,
      includeMetadataMissing: input.includeMetadataMissing,
      includeAliases: input.includeAliases,
      status: "active" as const,
      monitored: true,
      searchCutoffDate: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.db.insert(subscriptions).values(subscription);
      logger.info(
        `[SubscriptionService] ✅ Created subscription for ${input.entityType}: ${entityName} (subscription ID: ${subscription.id})`
      );
    } catch (error) {
      logger.error(
        `[SubscriptionService] ❌ Failed to create subscription for ${input.entityType}: ${entityName}`,
        error
      );
      throw error;
    }

    // If subscribing to a performer or studio, also subscribe to all their scenes
    if (input.entityType === "performer" || input.entityType === "studio") {
      await this.subscribeToEntityScenes(
        input.entityType,
        localEntityId, // Use local ID
        input.qualityProfileId,
        input.autoDownload,
        input.includeMetadataMissing,
        input.includeAliases
      );
    } else if (input.entityType === "scene") {
      // For single scene subscription, create folder and metadata immediately
      await this.createSceneFolderForSubscription(localEntityId);
    }

    return subscription;
  }

  /**
   * Subscribe to all scenes of a performer or studio
   * Fetches scenes from TPDB if available, then uses local database
   */
  private async subscribeToEntityScenes(
    entityType: "performer" | "studio",
    entityId: string,
    qualityProfileId: string,
    autoDownload: boolean,
    includeMetadataMissing: boolean,
    includeAliases: boolean
  ): Promise<void> {
    const now = new Date().toISOString();

    logger.info(
      `[SubscriptionService] Starting to subscribe to scenes for ${entityType} ${entityId}`
    );

    // First, fetch and save scenes from TPDB if available
    if (this.tpdb) {
      await this.fetchAndSaveScenesFromTPDB(entityType, entityId);
    }

    // Find all scenes for this entity from local database
    let entityScenes: any[] = [];

    if (entityType === "performer") {
      const performer = await this.db.query.performers.findFirst({
        where: eq(performers.id, entityId),
      });

      if (!performer) {
        logger.info(
          `[SubscriptionService] Performer ${entityId} not found in database`
        );
        return;
      }

      logger.info(
        `[SubscriptionService] Found performer: ${performer.name} (ID: ${performer.id})`
      );

      // Find scenes by performer using junction table
      const performerSceneRecords =
        await this.db.query.performersScenes.findMany({
          where: eq(performersScenes.performerId, performer.id),
        });

      logger.info(
        `[SubscriptionService] Found ${performerSceneRecords.length} performer-scene records`
      );

      // Get all scene IDs
      const sceneIds = performerSceneRecords.map((ps) => ps.sceneId);

      // Fetch all scenes
      entityScenes = await Promise.all(
        sceneIds.map((sceneId) =>
          this.db.query.scenes.findFirst({
            where: eq(scenes.id, sceneId),
          })
        )
      );
      entityScenes = entityScenes.filter(Boolean);
    } else if (entityType === "studio") {
      const studio = await this.db.query.studios.findFirst({
        where: eq(studios.id, entityId),
      });

      if (!studio) {
        logger.info(
          `[SubscriptionService] Studio ${entityId} not found in database`
        );
        return;
      }

      logger.info(
        `[SubscriptionService] Found studio: ${studio.name} (ID: ${studio.id})`
      );

      // Find scenes by studio using siteId foreign key
      entityScenes = await this.db.query.scenes.findMany({
        where: eq(scenes.siteId, studio.id),
      });

      logger.info(
        `[SubscriptionService] Found ${entityScenes.length} scenes for studio`
      );
    }

    // Create subscriptions for each scene
    const sceneSubscriptions = entityScenes.map((scene) => ({
      id: nanoid(),
      entityType: "scene" as const,
      entityId: scene.id,
      qualityProfileId: qualityProfileId,
      autoDownload: autoDownload,
      includeMetadataMissing: includeMetadataMissing,
      includeAliases: includeAliases,
      status: "active" as const,
      monitored: true,
      searchCutoffDate: null,
      createdAt: now,
      updatedAt: now,
    }));

    // Filter out scenes that are already subscribed
    const filteredSubscriptions = [];
    for (const sub of sceneSubscriptions) {
      const existingSceneSub = await this.db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.entityType, "scene"),
          eq(subscriptions.entityId, sub.entityId)
        ),
      });
      if (!existingSceneSub) {
        filteredSubscriptions.push(sub);
      }
    }

    // Bulk insert scene subscriptions
    if (filteredSubscriptions.length > 0) {
      logger.info(
        `[SubscriptionService] Creating ${filteredSubscriptions.length} scene subscriptions`
      );
      await this.db.insert(subscriptions).values(filteredSubscriptions);

      // Create folders and metadata for all new scene subscriptions
      logger.info(
        `[SubscriptionService] Creating folders and metadata for ${filteredSubscriptions.length} scenes`
      );
      for (const sub of filteredSubscriptions) {
        try {
          await this.createSceneFolderForSubscription(sub.entityId);
        } catch (error) {
          logger.error(
            `[SubscriptionService] Failed to create folder for scene ${sub.entityId}:`,
            error
          );
          // Continue with other scenes
        }
      }
    } else {
      logger.info(
        `[SubscriptionService] No new scene subscriptions to create (found ${entityScenes.length} scenes total)`
      );
    }

    // Note: We don't need a second loop to create folders for already-subscribed scenes
    // because the first loop (lines 435-445) already handles folder creation for all
    // new subscriptions. Any previously subscribed scenes already have their folders.
  }

  /**
   * Fetch scenes from TPDB and save to database
   * Orchestrates the scene fetching and saving process
   */
  private async fetchAndSaveScenesFromTPDB(
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<void> {
    if (!this.tpdb) {
      return;
    }

    try {
      // Get TPDB ID from the entity
      const tpdbId = await this.getTpdbIdForEntity(entityType, entityId);
      if (!tpdbId) {
        logger.info(`[SubscriptionService] No TPDB ID found for ${entityType} ${entityId}`);
        return;
      }

      logger.info(`[SubscriptionService] Fetching scenes from TPDB for ${entityType} ${tpdbId}`);

      // Fetch and deduplicate scenes from TPDB
      const tpdbScenes = await this.fetchPerformerScenesFromTPDB(
        tpdbId,
        entityType
      );

      logger.info(`[SubscriptionService] Found ${tpdbScenes.length} unique scenes from TPDB`);

      // Save each scene to database
      for (const tpdbScene of tpdbScenes) {
        try {
          const sceneId = await this.saveSceneToDatabase(
            tpdbScene,
            entityType,
            entityId
          );

          if (sceneId) {
            await this.linkSceneParticipants(sceneId, tpdbScene, entityType, entityId);
          }
        } catch (error) {
          logger.error(
            `[SubscriptionService] Failed to save scene ${tpdbScene.title}:`,
            error
          );
          // Continue with other scenes
        }
      }

      logger.info(`[SubscriptionService] Finished fetching scenes from TPDB`);
    } catch (error) {
      logger.error(
        `[SubscriptionService] Failed to fetch scenes from TPDB for ${entityType} ${entityId}:`,
        error
      );
      // Don't throw - continue with subscription
    }
  }

  /**
   * Get TPDB ID for entity
   */
  private async getTpdbIdForEntity(
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<string | null> {
    if (entityType === "performer") {
      const performer = await this.db.query.performers.findFirst({
        where: eq(performers.id, entityId),
      });
      return performer?.externalIds.find((e) => e.source === "tpdb")?.id || null;
    } else {
      const studio = await this.db.query.studios.findFirst({
        where: eq(studios.id, entityId),
      });
      return studio?.externalIds.find((e) => e.source === "tpdb")?.id || null;
    }
  }

  /**
   * Fetch performer scenes from TPDB with pagination and deduplication
   */
  private async fetchPerformerScenesFromTPDB(
    tpdbId: string,
    entityType: "performer" | "studio"
  ): Promise<any[]> {
    if (!this.tpdb) {
      return [];
    }

    if (entityType === "studio") {
      // TPDB doesn't have getSiteScenes, so we skip for now
      logger.info(`[SubscriptionService] Site scenes fetching not yet implemented`);
      return [];
    }

    // Fetch from all content types and combine
    const sceneTypes: Array<"scene" | "jav" | "movie"> = ["scene", "jav", "movie"];
    const allScenes: any[] = [];

    for (const contentType of sceneTypes) {
      try {
        logger.info(`[SubscriptionService] Fetching ${contentType}s for performer ${tpdbId}...`);

        let page = 1;
        let hasMore = true;
        let totalForType = 0;

        while (hasMore) {
          const result = await this.tpdb.getPerformerScenes(tpdbId, contentType, page);

          if (result.scenes.length === 0) {
            logger.info(`[SubscriptionService]   Page ${page}: No more ${contentType}s found`);
            hasMore = false;
          } else {
            logger.info(
              `[SubscriptionService]   Page ${page}: Found ${result.scenes.length} ${contentType}s`
            );
            allScenes.push(...result.scenes);
            totalForType += result.scenes.length;

            // Use pagination metadata if available
            if (result.pagination) {
              hasMore = result.pagination.hasMore;
              logger.info(
                `[SubscriptionService]   Progress: ${totalForType} / ${result.pagination.total} total ${contentType}s`
              );
            } else {
              // Fallback: if no pagination metadata, check scene count
              // TPDB typically returns 20 scenes per page
              hasMore = result.scenes.length >= 20;
            }

            page++;
          }
        }

        if (totalForType > 0) {
          logger.info(`[SubscriptionService] ✅ Total ${contentType}s fetched: ${totalForType}`);
        } else {
          logger.info(`[SubscriptionService] No ${contentType}s found for performer ${tpdbId}`);
        }
      } catch (error) {
        logger.info(
          `[SubscriptionService] ❌ Error fetching ${contentType}s for performer ${tpdbId}:`,
          error
        );
      }
    }

    // Apply deduplication across all content types
    const { deduplicateScenes } = await import("../utils/scene-deduplicator.js");
    logger.info(
      `[SubscriptionService] Applying deduplication to ${allScenes.length} total scenes...`
    );
    const uniqueScenes = deduplicateScenes(allScenes);
    const removed = allScenes.length - uniqueScenes.length;
    logger.info(
      `[SubscriptionService] ✅ Deduplication complete: ${uniqueScenes.length} unique scenes (removed ${removed} duplicates/trailers)`
    );

    return uniqueScenes;
  }

  /**
   * Save scene to database with duplicate detection
   * Returns scene ID (existing or newly created)
   */
  private async saveSceneToDatabase(
    tpdbScene: any,
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<string | null> {
    // Advanced duplicate checking
    let sceneId: string | null = null;

    // 1. Check by TPDB external ID
    const allScenes = await this.db.query.scenes.findMany();
    const existingByTpdbId = allScenes.find((s) =>
      s.externalIds.some((ext) => ext.source === "tpdb" && ext.id === tpdbScene.id)
    );

    if (existingByTpdbId) {
      sceneId = existingByTpdbId.id;
      logger.info(`[SubscriptionService] Scene "${tpdbScene.title}" already exists (by tpdbId)`);
      return sceneId;
    }

    // 2. Check by title + date combination (very likely duplicate)
    if (tpdbScene.title && tpdbScene.date) {
      const existingByTitleDate = await this.db.query.scenes.findFirst({
        where: and(eq(scenes.title, tpdbScene.title), eq(scenes.date, tpdbScene.date)),
      });

      if (existingByTitleDate) {
        sceneId = existingByTitleDate.id;
        logger.info(
          `[SubscriptionService] Scene "${tpdbScene.title}" already exists (by title+date)`
        );
        return sceneId;
      }
    }

    // 3. Check by JAV code (for JAV content)
    if (tpdbScene.contentType === "jav" && tpdbScene.code) {
      const baseCode = this.extractBaseStudioCode(tpdbScene.code);
      if (baseCode) {
        const allJavScenes = await this.db.query.scenes.findMany({
          where: eq(scenes.contentType, "jav"),
        });

        for (const javScene of allJavScenes) {
          if (javScene.code) {
            const existingBaseCode = this.extractBaseStudioCode(javScene.code);
            if (existingBaseCode === baseCode) {
              sceneId = javScene.id;
              logger.info(
                `[SubscriptionService] Scene "${tpdbScene.title}" already exists (by JAV code: ${baseCode})`
              );
              return sceneId;
            }
          }
        }
      }
    }

    // Determine studio ID for the scene
    let studioIdForScene: string | null = null;

    if (entityType === "studio") {
      studioIdForScene = entityId;
    } else if (tpdbScene.studio) {
      studioIdForScene = await this.getOrCreateStudio(tpdbScene.studio);
    }

    // Create new scene
    sceneId = nanoid();
    await this.db.insert(scenes).values({
      id: sceneId,
      externalIds: [{ source: "tpdb", id: tpdbScene.id }],
      slug: tpdbScene.slug,
      contentType: tpdbScene.contentType || "scene",
      title: tpdbScene.title,
      date: tpdbScene.date,
      duration: tpdbScene.duration,
      code: tpdbScene.code,
      images: tpdbScene.images,
      siteId: studioIdForScene,
      hasMetadata: true,
      inferredFromIndexers: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    logger.info(`[SubscriptionService] Created scene "${tpdbScene.title}"`);

    return sceneId;
  }

  /**
   * Link scene to performers and studios
   */
  private async linkSceneParticipants(
    sceneId: string,
    tpdbScene: any,
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<void> {
    // Link the subscribed entity (performer) to the scene first
    if (entityType === "performer") {
      await this.db
        .insert(performersScenes)
        .values({
          performerId: entityId,
          sceneId: sceneId,
        })
        .onConflictDoNothing();
    }

    // Link other performers from scene to scene
    if (tpdbScene.performers && tpdbScene.performers.length > 0) {
      for (const tpdbPerformer of tpdbScene.performers) {
        const performerId = await this.getOrCreatePerformer(tpdbPerformer);
        if (performerId) {
          await this.db
            .insert(performersScenes)
            .values({
              performerId,
              sceneId,
            })
            .onConflictDoNothing();
        }
      }
    }
  }

  /**
   * Get or create studio from TPDB data
   */
  private async getOrCreateStudio(tpdbStudio: any): Promise<string | null> {
    const allStudios = await this.db.query.studios.findMany();
    let studioRecord = allStudios.find((s) =>
      s.externalIds.some((ext) => ext.source === "tpdb" && ext.id === tpdbStudio.id)
    );

    if (studioRecord) {
      return studioRecord.id;
    }

    // Create studio if doesn't exist
    const studioId = nanoid();
    await this.db.insert(studios).values({
      id: studioId,
      externalIds: [{ source: "tpdb", id: tpdbStudio.id }],
      name: tpdbStudio.name,
      slug: tpdbStudio.name.toLowerCase().replace(/\s+/g, "-"),
      rating: 0,
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return studioId;
  }

  /**
   * Get or create performer from TPDB data
   */
  private async getOrCreatePerformer(tpdbPerformer: any): Promise<string | null> {
    const allPerformers = await this.db.query.performers.findMany();
    let performerRecord = allPerformers.find((p) =>
      p.externalIds.some((ext) => ext.source === "tpdb" && ext.id === tpdbPerformer.id)
    );

    if (performerRecord) {
      return performerRecord.id;
    }

    // Create performer if doesn't exist
    const performerId = nanoid();
    await this.db.insert(performers).values({
      id: performerId,
      externalIds: [{ source: "tpdb", id: tpdbPerformer.id }],
      slug: tpdbPerformer.slug || tpdbPerformer.name.toLowerCase().replace(/\s+/g, "-"),
      name: tpdbPerformer.name,
      fullName: tpdbPerformer.fullName || tpdbPerformer.name,
      rating: 0,
      aliases: [],
      disambiguation: tpdbPerformer.disambiguation,
      images: [],
      fakeBoobs: false,
      sameSexOnly: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return performerId;
  }

  /**
   * Create scene folder and metadata files for a subscription
   */
  private async createSceneFolderForSubscription(sceneId: string): Promise<void> {
    try {
      // Get scene to check if it has metadata
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, sceneId),
      });

      if (!scene) {
        logger.error(`[SubscriptionService] Scene ${sceneId} not found`);
        return;
      }

      // Get settings for file paths
      const { createSettingsService } = await import("./settings.service.js");
      const settingsService = createSettingsService(this.db);
      const settings = await settingsService.getSettings();

      // Import and create file manager service
      const { createFileManagerService } = await import("./file-manager.service.js");
      const fileManagerService = createFileManagerService(
        this.db,
        settings.general.scenesPath || "/media/scenes",
        settings.general.incompletePath || "/media/incomplete"
      );

      // Create folder with appropriate metadata
      if (scene.hasMetadata) {
        // Full metadata: create folder, download poster, generate complete NFO
        const { folderPath } = await fileManagerService.setupSceneFiles(sceneId);
        logger.info(
          `[SubscriptionService] ✅ Created scene folder with full metadata: ${folderPath}`
        );
      } else {
        // No metadata: create folder with simplified NFO only
        const { folderPath } = await fileManagerService.setupSceneFilesSimplified(sceneId);
        logger.info(
          `[SubscriptionService] ✅ Created scene folder with simplified metadata: ${folderPath}`
        );
      }
    } catch (error) {
      logger.error(
        `[SubscriptionService] Failed to create scene folder for ${sceneId}:`,
        error
      );
      // Don't throw - we want to continue with the subscription even if folder creation fails
    }
  }


  /**
   * Get subscription by entity
   */
  async getSubscriptionByEntity(
    entityType: string,
    entityId: string
  ): Promise<Subscription | null> {
    const subscription = await this.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.entityType, entityType as "performer" | "studio" | "scene"),
        eq(subscriptions.entityId, entityId)
      ),
    });

    return subscription || null;
  }

  /**
   * Get all subscriptions
   */
  async getAllSubscriptions(): Promise<Subscription[]> {
    return await this.db.query.subscriptions.findMany();
  }

  /**
   * Get all subscriptions with entity and quality profile details
   * OPTIMIZED: Batch fetches to avoid N+1 queries (2N+1 → 5 queries)
   */
  async getAllSubscriptionsWithDetails() {
    // 1. Fetch all subscriptions (1 query)
    const allSubscriptions = await this.db.query.subscriptions.findMany({
      with: {
        qualityProfile: true, // Eager load quality profiles
      },
    });

    // 2. Batch fetch entities by type
    const performerIds = allSubscriptions
      .filter((s) => s.entityType === "performer")
      .map((s) => s.entityId);
    const studioIds = allSubscriptions
      .filter((s) => s.entityType === "studio")
      .map((s) => s.entityId);
    const sceneIds = allSubscriptions
      .filter((s) => s.entityType === "scene")
      .map((s) => s.entityId);

    // Batch queries (3 queries total)
    const [performersMap, studiosMap, scenesMap] = await Promise.all([
      this.batchFetchPerformers(performerIds),
      this.batchFetchStudios(studioIds),
      this.batchFetchScenes(sceneIds),
    ]);

    // 3. Enrich subscriptions in memory (no queries)
    return allSubscriptions.map((subscription) => {
      let entity = null;
      let entityName = "Unknown";

      switch (subscription.entityType) {
        case "performer": {
          const performer = performersMap.get(subscription.entityId);
          if (performer) {
            entity = {
              ...performer,
              sameSexOnly: performer.sameSexOnly ?? false,
              fakeBoobs: performer.fakeBoobs ?? false,
            };
            entityName = performer.name;
          }
          break;
        }

        case "studio": {
          const studio = studiosMap.get(subscription.entityId);
          if (studio) {
            entity = studio;
            entityName = studio.name;
          }
          break;
        }

        case "scene": {
          const scene = scenesMap.get(subscription.entityId);
          if (scene) {
            entity = {
              ...scene,
              directorIds: [],
            };
            entityName = scene.title;
          }
          break;
        }
      }

      return {
        ...subscription,
        entityName,
        entity,
        qualityProfile: subscription.qualityProfile || null,
      };
    });
  }

  /**
   * Batch fetch performers by IDs
   */
  private async batchFetchPerformers(ids: string[]): Promise<Map<string, any>> {
    if (ids.length === 0) return new Map();

    const performersList = await this.db.query.performers.findMany();
    const filtered = performersList.filter((p) => ids.includes(p.id));

    return new Map(filtered.map((p) => [p.id, p]));
  }

  /**
   * Batch fetch studios by IDs
   */
  private async batchFetchStudios(ids: string[]): Promise<Map<string, any>> {
    if (ids.length === 0) return new Map();

    const studiosList = await this.db.query.studios.findMany();
    const filtered = studiosList.filter((s) => ids.includes(s.id));

    return new Map(filtered.map((s) => [s.id, s]));
  }

  /**
   * Batch fetch scenes by IDs with performers and site
   */
  private async batchFetchScenes(ids: string[]): Promise<Map<string, any>> {
    if (ids.length === 0) return new Map();

    const scenesList = await this.db.query.scenes.findMany({
      with: {
        performersScenes: {
          with: {
            performer: true,
          },
        },
        site: true,
      },
    });
    const filtered = scenesList.filter((s) => ids.includes(s.id));

    return new Map(filtered.map((s) => [s.id, s]));
  }

  /**
   * Get subscriptions by type
   */
  async getSubscriptionsByType(entityType: string): Promise<Subscription[]> {
    return await this.db.query.subscriptions.findMany({
      where: eq(subscriptions.entityType, entityType as "performer" | "studio" | "scene"),
    });
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    id: string,
    updates: Partial<Omit<Subscription, "id" | "createdAt">>
  ): Promise<Subscription> {
    const now = new Date().toISOString();

    const updateData: any = {
      ...updates,
      updatedAt: now,
    };

    await this.db
      .update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, id));

    const updated = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, id),
    });

    if (!updated) {
      throw new Error("Subscription not found");
    }

    return updated;
  }

  /**
   * Delete subscription
   * For performer/studio subscriptions, optionally delete associated scene subscriptions
   * For scene subscriptions, optionally delete scene files and folders
   */
  async deleteSubscription(
    id: string,
    deleteAssociatedScenes: boolean = false,
    removeFiles: boolean = false
  ): Promise<void> {
    // Get the subscription first to check if it's a performer/studio
    const subscription = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, id),
    });

    if (!subscription) {
      logger.warn(`[SubscriptionService] Subscription not found: ${id}`);
      throw new Error("Subscription not found");
    }

    // Get entity name for logging
    let entityName = "Unknown";
    if (subscription.entityType === "performer") {
      const performer = await this.db.query.performers.findFirst({
        where: eq(performers.id, subscription.entityId),
      });
      entityName = performer?.name || subscription.entityId;
    } else if (subscription.entityType === "studio") {
      const studio = await this.db.query.studios.findFirst({
        where: eq(studios.id, subscription.entityId),
      });
      entityName = studio?.name || subscription.entityId;
    } else if (subscription.entityType === "scene") {
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, subscription.entityId),
      });
      entityName = scene?.title || subscription.entityId;
    }

    logger.info(
      `[SubscriptionService] Deleting subscription for ${subscription.entityType}: ${entityName} (subscription ID: ${id}, removeFiles: ${removeFiles})`
    );

    // If it's a scene subscription and user wants to remove files
    if (subscription.entityType === "scene" && removeFiles) {
      await this.deleteSceneFilesAndFolder(subscription.entityId);
    }

    // Delete the main subscription
    await this.db.delete(subscriptions).where(eq(subscriptions.id, id));

    logger.info(
      `[SubscriptionService] ✅ Deleted subscription for ${subscription.entityType}: ${entityName}`
    );

    // If it's a performer or studio and user wants to delete associated scenes
    if (
      deleteAssociatedScenes &&
      (subscription.entityType === "performer" ||
        subscription.entityType === "studio")
    ) {
      await this.deleteEntitySceneSubscriptions(
        subscription.entityType,
        subscription.entityId,
        removeFiles
      );
    }
  }

  /**
   * Delete all scene subscriptions for a performer or studio
   * Optionally removes scene files and folders
   * Only deletes scenes that are not subscribed through other performers/studios
   */
  private async deleteEntitySceneSubscriptions(
    entityType: "performer" | "studio",
    entityId: string,
    removeFiles: boolean = false
  ): Promise<void> {
    // Find all scenes for this entity
    let entityScenes: any[] = [];

    if (entityType === "performer") {
      // Find scenes by performer using junction table
      const performerSceneRecords =
        await this.db.query.performersScenes.findMany({
          where: eq(performersScenes.performerId, entityId),
        });

      // Get all scene IDs
      const sceneIds = performerSceneRecords.map((ps) => ps.sceneId);

      // Fetch all scenes
      entityScenes = await Promise.all(
        sceneIds.map((sceneId) =>
          this.db.query.scenes.findFirst({
            where: eq(scenes.id, sceneId),
          })
        )
      );
      entityScenes = entityScenes.filter(Boolean);
    } else if (entityType === "studio") {
      // Find scenes by studio using siteId foreign key
      entityScenes = await this.db.query.scenes.findMany({
        where: eq(scenes.siteId, entityId),
      });
    }

    logger.info(
      `[SubscriptionService] Processing ${entityScenes.length} scenes for ${entityType} ${entityId} (removeFiles: ${removeFiles})`
    );

    // Delete subscriptions and optionally files for each scene
    for (const scene of entityScenes) {
      // Check if scene is subscribed through other performers/studios
      const shouldRemoveFiles = await this.shouldRemoveSceneFiles(
        scene.id,
        entityType,
        entityId,
        removeFiles
      );

      // Delete scene subscription
      await this.db
        .delete(subscriptions)
        .where(
          and(
            eq(subscriptions.entityType, "scene"),
            eq(subscriptions.entityId, scene.id)
          )
        );

      // Remove files if requested and not shared with other subscribed entities
      if (shouldRemoveFiles) {
        await this.deleteSceneFilesAndFolder(scene.id);
      }
    }
  }

  /**
   * Check if scene files should be removed when unsubscribing
   * Returns true only if:
   * - removeFiles is true AND
   * - Scene is not subscribed through any other active performer/studio subscriptions
   */
  private async shouldRemoveSceneFiles(
    sceneId: string,
    excludeEntityType: "performer" | "studio",
    excludeEntityId: string,
    removeFiles: boolean
  ): Promise<boolean> {
    if (!removeFiles) {
      return false;
    }

    // Get all performers for this scene
    const performerRecords = await this.db.query.performersScenes.findMany({
      where: (performersScenes, { eq }) => eq(performersScenes.sceneId, sceneId),
    });

    // Get the scene to check its studio (siteId)
    const sceneRecord = await this.db.query.scenes.findFirst({
      where: eq(scenes.id, sceneId),
    });

    // Check if any of these performers/studios have active subscriptions (excluding the one being deleted)
    for (const pr of performerRecords) {
      if (excludeEntityType === "performer" && pr.performerId === excludeEntityId) {
        continue; // Skip the performer being unsubscribed
      }

      const performerSub = await this.db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.entityType, "performer"),
          eq(subscriptions.entityId, pr.performerId)
        ),
      });

      if (performerSub) {
        logger.info(
          `[SubscriptionService] Scene ${sceneId} is still subscribed through performer ${pr.performerId}, keeping files`
        );
        return false; // Scene is subscribed through another performer
      }
    }

    // Check if scene's studio has an active subscription
    if (sceneRecord?.siteId) {
      if (excludeEntityType === "studio" && sceneRecord.siteId === excludeEntityId) {
        // Skip the studio being unsubscribed
      } else {
        const studioSub = await this.db.query.subscriptions.findFirst({
          where: and(
            eq(subscriptions.entityType, "studio"),
            eq(subscriptions.entityId, sceneRecord.siteId)
          ),
        });

        if (studioSub) {
          logger.info(
            `[SubscriptionService] Scene ${sceneId} is still subscribed through studio ${sceneRecord.siteId}, keeping files`
          );
          return false; // Scene is subscribed through its studio
        }
      }
    }

    // No other active subscriptions found, safe to remove files
    return true;
  }

  /**
   * Delete scene files and folder
   * Uses file manager service to clean up filesystem
   * Also removes torrents from qBittorrent if they exist
   */
  private async deleteSceneFilesAndFolder(sceneId: string): Promise<void> {
    try {
      const { createSettingsService } = await import("./settings.service.js");
      const settingsService = createSettingsService(this.db);
      const settings = await settingsService.getSettings();

      // Remove torrents from qBittorrent before deleting files
      const queueItems = await this.db.query.downloadQueue.findMany({
        where: eq(downloadQueue.sceneId, sceneId),
      });

      if (queueItems.length > 0 && settings.qbittorrent.enabled) {
        const { createQBittorrentService } = await import("./qbittorrent.service.js");
        const qbittorrent = createQBittorrentService({
          url: settings.qbittorrent.url,
          username: settings.qbittorrent.username,
          password: settings.qbittorrent.password,
        });

        for (const item of queueItems) {
          if (item.torrentHash) {
            try {
              await qbittorrent.removeTorrent(item.torrentHash, true);
              logger.info(`[SubscriptionService] Removed torrent ${item.torrentHash} from qBittorrent`);
            } catch (error) {
              logger.error(
                `[SubscriptionService] Failed to remove torrent ${item.torrentHash}:`,
                error
              );
              // Continue even if torrent removal fails
            }
          }
        }

        // Delete download queue entries
        await this.db.delete(downloadQueue).where(eq(downloadQueue.sceneId, sceneId));
        logger.info(`[SubscriptionService] Deleted ${queueItems.length} download queue entries for scene ${sceneId}`);
      }

      // Delete files and folder
      const { createFileManagerService } = await import("./file-manager.service.js");
      const fileManagerService = createFileManagerService(
        this.db,
        settings.general.scenesPath || "/media/scenes",
        settings.general.incompletePath || "/media/incomplete"
      );

      await fileManagerService.deleteSceneFolder(sceneId, "user_deleted");
      logger.info(`[SubscriptionService] ✅ Deleted files and folder for scene ${sceneId}`);
    } catch (error) {
      logger.error(
        `[SubscriptionService] Failed to delete files for scene ${sceneId}:`,
        error
      );
      // Don't throw - we want to continue with subscription deletion even if file deletion fails
    }
  }

  /**
   * Delete subscription by entity
   */
  async deleteSubscriptionByEntity(
    entityType: string,
    entityId: string
  ): Promise<void> {
    await this.db
      .delete(subscriptions)
      .where(
        and(
          eq(subscriptions.entityType, entityType as "performer" | "studio" | "scene"),
          eq(subscriptions.entityId, entityId)
        )
      );
  }

  /**
   * Toggle subscription monitoring
   */
  async toggleMonitoring(id: string): Promise<Subscription> {
    const subscription = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, id),
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    return await this.updateSubscription(id, {
      monitored: !subscription.monitored,
    });
  }

  /**
   * Pause/Resume subscription
   */
  async toggleStatus(id: string): Promise<Subscription> {
    const subscription = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, id),
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    const newStatus = subscription.status === "active" ? "paused" : "active";

    return await this.updateSubscription(id, {
      status: newStatus,
    });
  }

  /**
   * Extract base studio code from JAV codes
   * Example: rebdb-957tk1 -> rebdb-957
   */
  private extractBaseStudioCode(code: string): string | null {
    if (!code) return null;

    const match = code.match(/^([a-zA-Z]+-\d+)/i);

    if (match) {
      return match[1].toLowerCase();
    }

    return null;
  }

  /**
   * Validate that entity exists in local database
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  /**
   * Get subscription with entity details
   */
  async getSubscriptionWithDetails(id: string) {
    const subscription = await this.db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, id),
    });

    if (!subscription) {
      return null;
    }

    let entity = null;
    let entityName = "Unknown";

    switch (subscription.entityType) {
      case "performer":
        entity = await this.db.query.performers.findFirst({
          where: eq(performers.id, subscription.entityId),
        });
        entityName = entity?.name || subscription.entityId;
        break;

      case "studio":
        entity = await this.db.query.studios.findFirst({
          where: eq(studios.id, subscription.entityId),
        });
        entityName = entity?.name || subscription.entityId;
        break;

      case "scene":
        entity = await this.db.query.scenes.findFirst({
          where: eq(scenes.id, subscription.entityId),
          with: {
            performersScenes: {
              with: {
                performer: true,
              },
            },
            site: true,
          },
        });
        entityName = entity?.title || subscription.entityId;
        break;
    }

    // Get quality profile
    const qualityProfile = await this.db.query.qualityProfiles.findFirst({
      where: eq(qualityProfiles.id, subscription.qualityProfileId),
    });

    return {
      ...subscription,
      entityName,
      entity,
      qualityProfile: qualityProfile || null,
    };
  }
}

// Export factory function
export function createSubscriptionService(
  db: Database,
  tpdb?: TPDBService
): SubscriptionService {
  return new SubscriptionService(db, tpdb);
}
