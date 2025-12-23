/**
 * Subscription Service
 * Handles creating and managing subscriptions for performers, studios, and scenes
 */

import { eq, and } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  subscriptions,
  performers,
  studios,
  scenes,
  qualityProfiles,
  performersScenes,
  studiosScenes,
  sceneFiles,
} from "@repo/database";
import { nanoid } from "nanoid";
import type * as schema from "@repo/database";
import type { TPDBService } from "./tpdb/tpdb.service.js";

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
  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private tpdb?: TPDBService
  ) {}

  /**
   * Get local entity ID - checks local database first, then fetches from TPDB if available
   */
  private async getLocalEntityId(
    entityType: string,
    entityId: string
  ): Promise<string | null> {
    switch (entityType) {
      case "performer": {
        // Check local DB first by local ID
        let performer = await this.db.query.performers.findFirst({
          where: eq(performers.id, entityId),
        });

        // If not found by local ID, try by TPDB ID
        if (!performer) {
          performer = await this.db.query.performers.findFirst({
            where: eq(performers.tpdbId, entityId),
          });
        }

        // If still not found and TPDB is available, try fetching from TPDB
        if (!performer && this.tpdb) {
          try {
            console.log(`[SubscriptionService] Performer ${entityId} not found locally, fetching from TPDB`);
            const tpdbPerformer = await this.tpdb.getPerformerById(entityId);

            if (tpdbPerformer) {
              // Check once more if performer was created in the meantime (race condition)
              performer = await this.db.query.performers.findFirst({
                where: eq(performers.tpdbId, tpdbPerformer.id),
              });

              if (!performer) {
                // Create performer in local DB
                const localId = nanoid();
                await this.db.insert(performers).values({
                  id: localId,
                  tpdbId: tpdbPerformer.id,
                  name: tpdbPerformer.name,
                  aliases: tpdbPerformer.aliases || [],
                  disambiguation: tpdbPerformer.disambiguation,
                  gender: tpdbPerformer.gender,
                  birthdate: tpdbPerformer.birthdate,
                  deathDate: tpdbPerformer.deathDate,
                  careerStartDate: tpdbPerformer.careerStartDate,
                  careerEndDate: tpdbPerformer.careerEndDate,
                  careerLength: tpdbPerformer.careerLength,
                  bio: tpdbPerformer.bio,
                  measurements: tpdbPerformer.measurements,
                  tattoos: tpdbPerformer.tattoos,
                  piercings: tpdbPerformer.piercings,
                  images: tpdbPerformer.images,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
                console.log(`[SubscriptionService] Created performer ${tpdbPerformer.name} with ID ${localId}`);
                return localId;
              }
            }
          } catch (error) {
            console.error(`[SubscriptionService] Failed to fetch performer from TPDB:`, error);
          }
        }

        return performer?.id || null;
      }

      case "studio": {
        // Check local DB first by local ID
        let studio = await this.db.query.studios.findFirst({
          where: eq(studios.id, entityId),
        });

        // If not found by local ID, try by TPDB ID
        if (!studio) {
          studio = await this.db.query.studios.findFirst({
            where: eq(studios.tpdbId, entityId),
          });
        }

        // If still not found and TPDB is available, try fetching from TPDB
        if (!studio && this.tpdb) {
          try {
            console.log(`[SubscriptionService] Studio ${entityId} not found locally, fetching from TPDB`);
            const tpdbSite = await this.tpdb.getSiteById(entityId);

            if (tpdbSite) {
              // Check once more if studio was created in the meantime (race condition)
              studio = await this.db.query.studios.findFirst({
                where: eq(studios.tpdbId, tpdbSite.id),
              });

              if (!studio) {
                // Create studio in local DB
                const localId = nanoid();
                await this.db.insert(studios).values({
                  id: localId,
                  tpdbId: tpdbSite.id,
                  name: tpdbSite.name,
                  aliases: tpdbSite.aliases || [],
                  parentStudioId: tpdbSite.parentStudioId,
                  url: tpdbSite.url,
                  images: tpdbSite.images,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
                console.log(`[SubscriptionService] Created studio ${tpdbSite.name} with ID ${localId}`);
                return localId;
              }
            }
          } catch (error) {
            console.error(`[SubscriptionService] Failed to fetch studio from TPDB:`, error);
          }
        }

        return studio?.id || null;
      }

      case "scene": {
        const scene = await this.db.query.scenes.findFirst({
          where: eq(scenes.id, entityId),
        });
        return scene?.id || null;
      }

      default:
        return null;
    }
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
      console.error(
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

    console.log(
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
      console.warn(
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
      console.log(
        `[SubscriptionService] ✅ Created subscription for ${input.entityType}: ${entityName} (subscription ID: ${subscription.id})`
      );
    } catch (error) {
      console.error(
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

    console.log(
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
        console.log(
          `[SubscriptionService] Performer ${entityId} not found in database`
        );
        return;
      }

      console.log(
        `[SubscriptionService] Found performer: ${performer.name} (ID: ${performer.id})`
      );

      // Find scenes by performer using junction table
      const performerSceneRecords =
        await this.db.query.performersScenes.findMany({
          where: eq(performersScenes.performerId, performer.id),
        });

      console.log(
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
        console.log(
          `[SubscriptionService] Studio ${entityId} not found in database`
        );
        return;
      }

      console.log(
        `[SubscriptionService] Found studio: ${studio.name} (ID: ${studio.id})`
      );

      // Find scenes by studio using junction table
      const studioSceneRecords = await this.db.query.studiosScenes.findMany({
        where: eq(studiosScenes.studioId, studio.id),
      });

      console.log(
        `[SubscriptionService] Found ${studioSceneRecords.length} studio-scene records`
      );

      // Get all scene IDs
      const sceneIds = studioSceneRecords.map((ss) => ss.sceneId);

      // Fetch all scenes
      entityScenes = await Promise.all(
        sceneIds.map((sceneId) =>
          this.db.query.scenes.findFirst({
            where: eq(scenes.id, sceneId),
          })
        )
      );
      entityScenes = entityScenes.filter(Boolean);
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
      console.log(
        `[SubscriptionService] Creating ${filteredSubscriptions.length} scene subscriptions`
      );
      await this.db.insert(subscriptions).values(filteredSubscriptions);

      // Create folders and metadata for all new scene subscriptions
      console.log(
        `[SubscriptionService] Creating folders and metadata for ${filteredSubscriptions.length} scenes`
      );
      for (const sub of filteredSubscriptions) {
        try {
          await this.createSceneFolderForSubscription(sub.entityId);
        } catch (error) {
          console.error(
            `[SubscriptionService] Failed to create folder for scene ${sub.entityId}:`,
            error
          );
          // Continue with other scenes
        }
      }
    } else {
      console.log(
        `[SubscriptionService] No new scene subscriptions to create (found ${entityScenes.length} scenes total)`
      );
    }

    // Note: We don't need a second loop to create folders for already-subscribed scenes
    // because the first loop (lines 435-445) already handles folder creation for all
    // new subscriptions. Any previously subscribed scenes already have their folders.
  }

  /**
   * Fetch scenes from TPDB and save to database
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
      let tpdbId: string | null = null;

      if (entityType === "performer") {
        const performer = await this.db.query.performers.findFirst({
          where: eq(performers.id, entityId),
        });
        tpdbId = performer?.tpdbId || null;
      } else if (entityType === "studio") {
        const studio = await this.db.query.studios.findFirst({
          where: eq(studios.id, entityId),
        });
        tpdbId = studio?.tpdbId || null;
      }

      if (!tpdbId) {
        console.log(`[SubscriptionService] No TPDB ID found for ${entityType} ${entityId}`);
        return;
      }

      console.log(`[SubscriptionService] Fetching scenes from TPDB for ${entityType} ${tpdbId}`);

      // Fetch scenes from TPDB
      let tpdbScenes: any[] = [];
      if (entityType === "performer") {
        // Fetch from all content types and combine
        const sceneTypes: Array<"scene" | "jav" | "movie"> = ["scene", "jav", "movie"];
        const allScenes: any[] = [];

        for (const contentType of sceneTypes) {
          try {
            console.log(`[SubscriptionService] Fetching ${contentType}s for performer ${tpdbId}...`);

            // Fetch all pages for this content type
            let page = 1;
            let hasMore = true;
            let totalForType = 0;

            while (hasMore) {
              const result = await this.tpdb.getPerformerScenes(tpdbId, contentType, page, false);

              if (result.scenes.length === 0) {
                console.log(`[SubscriptionService]   Page ${page}: No more ${contentType}s found`);
                hasMore = false;
              } else {
                console.log(`[SubscriptionService]   Page ${page}: Found ${result.scenes.length} ${contentType}s`);
                allScenes.push(...result.scenes);
                totalForType += result.scenes.length;

                // Use pagination metadata if available
                if (result.pagination) {
                  hasMore = result.pagination.hasMore;
                  console.log(`[SubscriptionService]   Progress: ${totalForType} / ${result.pagination.total} total ${contentType}s`);
                } else {
                  // Fallback: if no pagination metadata, check scene count
                  // TPDB typically returns 20 scenes per page
                  hasMore = result.scenes.length >= 20;
                }

                page++;
              }
            }

            if (totalForType > 0) {
              console.log(`[SubscriptionService] ✅ Total ${contentType}s fetched: ${totalForType}`);
            } else {
              console.log(`[SubscriptionService] No ${contentType}s found for performer ${tpdbId}`);
            }
          } catch (error) {
            console.log(`[SubscriptionService] ❌ Error fetching ${contentType}s for performer ${tpdbId}:`, error);
          }
        }

        // Apply deduplication across all content types
        const { deduplicateScenes } = await import("../utils/scene-deduplicator.js");
        console.log(`[SubscriptionService] Applying deduplication to ${allScenes.length} total scenes...`);
        tpdbScenes = deduplicateScenes(allScenes);
        const removed = allScenes.length - tpdbScenes.length;
        console.log(`[SubscriptionService] ✅ Deduplication complete: ${tpdbScenes.length} unique scenes (removed ${removed} duplicates/trailers)`);
      } else {
        // TPDB doesn't have getSiteScenes, so we skip for now
        console.log(`[SubscriptionService] Site scenes fetching not yet implemented`);
        return;
      }

      console.log(`[SubscriptionService] Found ${tpdbScenes.length} unique scenes from TPDB`);

      // Save each scene to database
      for (const tpdbScene of tpdbScenes) {
        try {
          // Advanced duplicate checking
          let sceneId: string | null = null;

          // 1. Check by tpdbId
          const existingByTpdbId = await this.db.query.scenes.findFirst({
            where: eq(scenes.tpdbId, tpdbScene.id),
          });

          if (existingByTpdbId) {
            sceneId = existingByTpdbId.id;
            console.log(`[SubscriptionService] Scene "${tpdbScene.title}" already exists (by tpdbId)`);
          }

          // 2. Check by title + date combination (very likely duplicate)
          if (!sceneId && tpdbScene.title && tpdbScene.date) {
            const existingByTitleDate = await this.db.query.scenes.findFirst({
              where: and(
                eq(scenes.title, tpdbScene.title),
                eq(scenes.date, tpdbScene.date)
              ),
            });

            if (existingByTitleDate) {
              sceneId = existingByTitleDate.id;
              console.log(`[SubscriptionService] Scene "${tpdbScene.title}" already exists (by title+date) - different tpdb_id detected!`);
            }
          }

          // 3. Check by JAV code (for JAV content)
          if (!sceneId && tpdbScene.tpdbContentType === 'jav' && tpdbScene.code) {
            const baseCode = this.extractBaseStudioCode(tpdbScene.code);
            if (baseCode) {
              const allJavScenes = await this.db.query.scenes.findMany({
                where: eq(scenes.tpdbContentType, 'jav'),
              });

              for (const javScene of allJavScenes) {
                if (javScene.code) {
                  const existingBaseCode = this.extractBaseStudioCode(javScene.code);
                  if (existingBaseCode === baseCode) {
                    sceneId = javScene.id;
                    console.log(`[SubscriptionService] Scene "${tpdbScene.title}" already exists (by JAV code pattern: ${baseCode})`);
                    break;
                  }
                }
              }
            }
          }

          // If no duplicate found, create new scene
          if (!sceneId) {
            sceneId = nanoid();
            await this.db.insert(scenes).values({
              id: sceneId,
              tpdbId: tpdbScene.id,
              tpdbContentType: tpdbScene.tpdbContentType,
              title: tpdbScene.title,
              date: tpdbScene.date,
              details: tpdbScene.details,
              duration: tpdbScene.duration,
              director: tpdbScene.director,
              code: tpdbScene.code,
              urls: tpdbScene.urls,
              images: tpdbScene.images,
              hasMetadata: true,
              inferredFromIndexers: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            console.log(`[SubscriptionService] Created scene "${tpdbScene.title}"`);
          }

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
              let performerRecord = await this.db.query.performers.findFirst({
                where: eq(performers.tpdbId, tpdbPerformer.id),
              });

              if (!performerRecord) {
                // Create performer if doesn't exist
                const performerId = nanoid();
                await this.db.insert(performers).values({
                  id: performerId,
                  tpdbId: tpdbPerformer.id,
                  name: tpdbPerformer.name,
                  aliases: [],
                  disambiguation: tpdbPerformer.disambiguation,
                  images: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });

                performerRecord = await this.db.query.performers.findFirst({
                  where: eq(performers.id, performerId),
                });
              }

              if (performerRecord) {
                // Link performer to scene
                await this.db
                  .insert(performersScenes)
                  .values({
                    performerId: performerRecord.id,
                    sceneId: sceneId,
                  })
                  .onConflictDoNothing();
              }
            }
          }

          // Link the subscribed entity (studio) to the scene first
          if (entityType === "studio") {
            await this.db
              .insert(studiosScenes)
              .values({
                studioId: entityId,
                sceneId: sceneId,
              })
              .onConflictDoNothing();
          }

          // Link studio from scene metadata to scene
          if (tpdbScene.studio) {
            let studioRecord = await this.db.query.studios.findFirst({
              where: eq(studios.tpdbId, tpdbScene.studio.id),
            });

            if (!studioRecord) {
              // Create studio if doesn't exist
              const studioId = nanoid();
              await this.db.insert(studios).values({
                id: studioId,
                tpdbId: tpdbScene.studio.id,
                name: tpdbScene.studio.name,
                aliases: [],
                images: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });

              studioRecord = await this.db.query.studios.findFirst({
                where: eq(studios.id, studioId),
              });
            }

            if (studioRecord) {
              // Link studio to scene
              await this.db
                .insert(studiosScenes)
                .values({
                  studioId: studioRecord.id,
                  sceneId: sceneId,
                })
                .onConflictDoNothing();
            }
          }
        } catch (error) {
          console.error(
            `[SubscriptionService] Failed to save scene ${tpdbScene.title}:`,
            error
          );
          // Continue with other scenes
        }
      }

      console.log(`[SubscriptionService] Finished fetching scenes from TPDB`);
    } catch (error) {
      console.error(
        `[SubscriptionService] Failed to fetch scenes from TPDB for ${entityType} ${entityId}:`,
        error
      );
      // Don't throw - continue with subscription
    }
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
        console.error(`[SubscriptionService] Scene ${sceneId} not found`);
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
        console.log(
          `[SubscriptionService] ✅ Created scene folder with full metadata: ${folderPath}`
        );
      } else {
        // No metadata: create folder with simplified NFO only
        const { folderPath } = await fileManagerService.setupSceneFilesSimplified(sceneId);
        console.log(
          `[SubscriptionService] ✅ Created scene folder with simplified metadata: ${folderPath}`
        );
      }
    } catch (error) {
      console.error(
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
   */
  async getAllSubscriptionsWithDetails() {
    const allSubscriptions = await this.db.query.subscriptions.findMany();

    const subscriptionsWithDetails = await Promise.all(
      allSubscriptions.map(async (subscription) => {
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
                studiosScenes: {
                  with: {
                    studio: true,
                  },
                },
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
      })
    );

    return subscriptionsWithDetails;
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
      console.warn(`[SubscriptionService] Subscription not found: ${id}`);
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

    console.log(
      `[SubscriptionService] Deleting subscription for ${subscription.entityType}: ${entityName} (subscription ID: ${id}, removeFiles: ${removeFiles})`
    );

    // If it's a scene subscription and user wants to remove files
    if (subscription.entityType === "scene" && removeFiles) {
      await this.deleteSceneFilesAndFolder(subscription.entityId);
    }

    // Delete the main subscription
    await this.db.delete(subscriptions).where(eq(subscriptions.id, id));

    console.log(
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
      // Find scenes by studio using junction table
      const studioSceneRecords = await this.db.query.studiosScenes.findMany({
        where: eq(studiosScenes.studioId, entityId),
      });

      // Get all scene IDs
      const sceneIds = studioSceneRecords.map((ss) => ss.sceneId);

      // Fetch all scenes
      entityScenes = await Promise.all(
        sceneIds.map((sceneId) =>
          this.db.query.scenes.findFirst({
            where: eq(scenes.id, sceneId),
          })
        )
      );
      entityScenes = entityScenes.filter(Boolean);
    }

    console.log(
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

    // Get all studios for this scene
    const studioRecords = await this.db.query.studiosScenes.findMany({
      where: (studiosScenes, { eq }) => eq(studiosScenes.sceneId, sceneId),
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
        console.log(
          `[SubscriptionService] Scene ${sceneId} is still subscribed through performer ${pr.performerId}, keeping files`
        );
        return false; // Scene is subscribed through another performer
      }
    }

    for (const sr of studioRecords) {
      if (excludeEntityType === "studio" && sr.studioId === excludeEntityId) {
        continue; // Skip the studio being unsubscribed
      }

      const studioSub = await this.db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.entityType, "studio"),
          eq(subscriptions.entityId, sr.studioId)
        ),
      });

      if (studioSub) {
        console.log(
          `[SubscriptionService] Scene ${sceneId} is still subscribed through studio ${sr.studioId}, keeping files`
        );
        return false; // Scene is subscribed through another studio
      }
    }

    // No other active subscriptions found, safe to remove files
    return true;
  }

  /**
   * Delete scene files and folder
   * Uses file manager service to clean up filesystem
   */
  private async deleteSceneFilesAndFolder(sceneId: string): Promise<void> {
    try {
      const { createSettingsService } = await import("./settings.service.js");
      const settingsService = createSettingsService(this.db);
      const settings = await settingsService.getSettings();

      const { createFileManagerService } = await import("./file-manager.service.js");
      const fileManagerService = createFileManagerService(
        this.db,
        settings.general.scenesPath || "/media/scenes",
        settings.general.incompletePath || "/media/incomplete"
      );

      await fileManagerService.deleteSceneFolder(sceneId, "user_deleted");
      console.log(`[SubscriptionService] ✅ Deleted files and folder for scene ${sceneId}`);
    } catch (error) {
      console.error(
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
  private async _validateEntity(
    entityType: string,
    entityId: string
  ): Promise<void> {
    let exists = false;

    switch (entityType) {
      case "performer":
        const performer = await this.db.query.performers.findFirst({
          where: eq(performers.id, entityId),
        });
        exists = !!performer;
        break;

      case "studio":
        const studio = await this.db.query.studios.findFirst({
          where: eq(studios.id, entityId),
        });
        exists = !!studio;
        break;

      case "scene":
        const scene = await this.db.query.scenes.findFirst({
          where: eq(scenes.id, entityId),
        });
        exists = !!scene;
        break;

      default:
        throw new Error(`Invalid entity type: ${entityType}`);
    }

    if (!exists) {
      throw new Error(`${entityType} not found with id: ${entityId}`);
    }
  }

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
            studiosScenes: {
              with: {
                studio: true,
              },
            },
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSubscriptionService(db: any, tpdb?: TPDBService) {
  return new SubscriptionService(db, tpdb);
}
