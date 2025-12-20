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
import { GraphQLClient } from "graphql-request";
import {
  GET_PERFORMER_SCENES_QUERY,
  GET_STUDIO_SCENES_QUERY,
  GET_SCENE_QUERY,
} from "./stashdb.queries.js";

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
  private stashdbClient: GraphQLClient | null = null;

  constructor(private db: BetterSQLite3Database<typeof schema>) {
    // Initialize StashDB client with settings from database
    this.initializeStashDBClient();
  }

  private async initializeStashDBClient() {
    try {
      const { createSettingsService } = await import("./settings.service.js");
      const settingsService = createSettingsService(this.db);
      const settings = await settingsService.getSettings();

      if (settings.stashdb.enabled && settings.stashdb.apiKey) {
        this.stashdbClient = new GraphQLClient(settings.stashdb.apiUrl, {
          headers: { ApiKey: settings.stashdb.apiKey },
          requestMiddleware: (request) => {
            return {
              ...request,
              signal: AbortSignal.timeout(30000), // 30 second timeout
            };
          },
        });
      } else {
        console.warn("[SubscriptionService] StashDB not configured. Subscription functionality will be limited.");
        this.stashdbClient = null;
      }
    } catch (error) {
      console.error("[SubscriptionService] Failed to initialize StashDB client:", error);
      this.stashdbClient = null;
    }
  }

  /**
   * Get local entity ID from either local ID or StashDB ID
   * If entity doesn't exist, fetch from StashDB and create it
   */
  private async getLocalEntityId(
    entityType: string,
    entityId: string
  ): Promise<string | null> {
    switch (entityType) {
      case "performer":
        let performer = await this.db.query.performers.findFirst({
          where: eq(performers.id, entityId),
        });
        if (!performer) {
          performer = await this.db.query.performers.findFirst({
            where: eq(performers.stashdbId, entityId),
          });
        }

        // If performer doesn't exist and entityId looks like a StashDB UUID, fetch and create it
        if (!performer && this.isUUID(entityId)) {
          console.log(`[SubscriptionService] Performer ${entityId} not found locally, fetching from StashDB`);
          const performerData = await this.stashdbClient?.request(
            `query {
              findPerformer(id: "${entityId}") {
                id
                name
                disambiguation
                gender
                birth_date
                death_date
                career_start_year
                career_end_year
                cup_size
                band_size
                waist_size
                hip_size
                tattoos {
                  location
                  description
                }
                piercings {
                  location
                  description
                }
                aliases
                images {
                  url
                  width
                  height
                }
              }
            }`
          );

          if (performerData?.findPerformer) {
            const p = performerData.findPerformer;
            const localId = nanoid();

            // Format body modifications to string
            const formatBodyMods = (mods: any[]) => {
              if (!mods || mods.length === 0) return null;
              return mods.map(m => `${m.location}${m.description ? `: ${m.description}` : ''}`).join(', ');
            };

            // Format measurements
            const formatMeasurements = () => {
              const parts = [];
              if (p.cup_size || p.band_size) {
                parts.push(`${p.cup_size || ''}${p.band_size || ''}`);
              }
              if (p.waist_size) parts.push(String(p.waist_size));
              if (p.hip_size) parts.push(String(p.hip_size));
              return parts.length > 0 ? parts.join('-') : null;
            };

            // Calculate career length
            const careerLength = p.career_start_year && p.career_end_year
              ? `${p.career_end_year - p.career_start_year} years`
              : p.career_start_year
              ? `${new Date().getFullYear() - p.career_start_year}+ years`
              : null;

            await this.db.insert(performers).values({
              id: localId,
              stashdbId: p.id,
              name: p.name,
              aliases: p.aliases || [],
              disambiguation: p.disambiguation,
              gender: p.gender,
              birthdate: p.birth_date,
              deathDate: p.death_date,
              careerStartDate: p.career_start_year ? String(p.career_start_year) : null,
              careerEndDate: p.career_end_year ? String(p.career_end_year) : null,
              careerLength: careerLength,
              bio: null, // StashDB doesn't have bio field
              measurements: formatMeasurements(),
              tattoos: formatBodyMods(p.tattoos),
              piercings: formatBodyMods(p.piercings),
              images: p.images || [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            console.log(`[SubscriptionService] Created performer ${p.name} with ID ${localId}`);
            return localId;
          }
        }
        return performer?.id || null;

      case "studio":
        let studio = await this.db.query.studios.findFirst({
          where: eq(studios.id, entityId),
        });
        if (!studio) {
          studio = await this.db.query.studios.findFirst({
            where: eq(studios.stashdbId, entityId),
          });
        }

        // If studio doesn't exist and entityId looks like a StashDB UUID, fetch and create it
        if (!studio && this.isUUID(entityId)) {
          console.log(`[SubscriptionService] Studio ${entityId} not found locally, fetching from StashDB`);
          const studioData = await this.stashdbClient?.request(
            `query { findStudio(id: "${entityId}") { id name parent { id } urls { url type } images { url width height } }`
          );

          if (studioData?.findStudio) {
            const s = studioData.findStudio;
            const localId = nanoid();
            await this.db.insert(studios).values({
              id: localId,
              stashdbId: s.id,
              name: s.name,
              aliases: [],
              parentStudioId: s.parent?.id || null,
              url: s.urls?.[0]?.url || null,
              images: s.images || [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            console.log(`[SubscriptionService] Created studio ${s.name} with ID ${localId}`);
            return localId;
          }
        }
        return studio?.id || null;

      case "scene":
        let scene = await this.db.query.scenes.findFirst({
          where: eq(scenes.id, entityId),
        });
        if (!scene) {
          scene = await this.db.query.scenes.findFirst({
            where: eq(scenes.stashdbId, entityId),
          });
        }

        // If scene doesn't exist and entityId looks like a StashDB UUID, fetch and create it
        if (!scene && this.isUUID(entityId)) {
          console.log(`[SubscriptionService] Scene ${entityId} not found locally, fetching from StashDB`);
          await this.fetchAndSaveScene(entityId);

          // After fetching, find the scene again
          scene = await this.db.query.scenes.findFirst({
            where: eq(scenes.stashdbId, entityId),
          });
        }
        return scene?.id || null;

      default:
        return null;
    }
  }

  private isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
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
   * First fetches scenes from StashDB and saves them to database
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

    // First, fetch and save scenes from StashDB
    await this.fetchAndSaveScenesFromStashDB(entityType, entityId);

    // Find all scenes for this entity from database
    let entityScenes: any[] = [];

    if (entityType === "performer") {
      // Get the performer - entityId could be either local ID or StashDB ID
      let performer = await this.db.query.performers.findFirst({
        where: eq(performers.id, entityId),
      });

      // If not found by local ID, try StashDB ID
      if (!performer) {
        performer = await this.db.query.performers.findFirst({
          where: eq(performers.stashdbId, entityId),
        });
      }

      if (!performer) {
        console.log(
          `[SubscriptionService] Performer ${entityId} not found in database (tried both local ID and StashDB ID)`
        );
        return;
      }

      console.log(
        `[SubscriptionService] Found performer: ${performer.name} (local ID: ${performer.id}, StashDB ID: ${performer.stashdbId})`
      );

      console.log(
        `[SubscriptionService] Looking for scenes for performer ID: ${performer.id}`
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
      // Get the studio - entityId could be either local ID or StashDB ID
      let studio = await this.db.query.studios.findFirst({
        where: eq(studios.id, entityId),
      });

      // If not found by local ID, try StashDB ID
      if (!studio) {
        studio = await this.db.query.studios.findFirst({
          where: eq(studios.stashdbId, entityId),
        });
      }

      if (!studio) {
        console.log(
          `[SubscriptionService] Studio ${entityId} not found in database (tried both local ID and StashDB ID)`
        );
        return;
      }

      console.log(
        `[SubscriptionService] Found studio: ${studio.name} (local ID: ${studio.id}, StashDB ID: ${studio.stashdbId})`
      );

      console.log(
        `[SubscriptionService] Looking for scenes for studio ID: ${studio.id}`
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

    // Also create folders for ALL scenes, including already subscribed ones
    // This ensures folders exist even if subscription was created before
    console.log(
      `[SubscriptionService] Ensuring folders exist for all ${entityScenes.length} scenes (including already subscribed)`
    );
    for (const scene of entityScenes) {
      try {
        // Check if folder already exists by checking if scene has files
        const existingFiles = await this.db.query.sceneFiles.findMany({
          where: (sceneFiles, { eq }) => eq(sceneFiles.sceneId, scene.id),
        });

        // Only create folder if no files exist (folder not created yet)
        if (existingFiles.length === 0) {
          console.log(
            `[SubscriptionService] Creating missing folder for scene ${scene.id}: ${scene.title}`
          );
          await this.createSceneFolderForSubscription(scene.id);
        }
      } catch (error) {
        console.error(
          `[SubscriptionService] Failed to ensure folder for scene ${scene.id}:`,
          error
        );
        // Continue with other scenes
      }
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
      if (scene.hasMetadata && scene.stashdbId) {
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
   * Fetch scenes from StashDB and save to database
   */
  private async fetchAndSaveScenesFromStashDB(
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<void> {
    if (!this.stashdbClient) {
      console.log(`[SubscriptionService] StashDB client not initialized`);
      return;
    }

    try {
      // Get StashDB ID - entityId might be local ID or StashDB ID
      let stashdbId = entityId;

      if (entityType === "performer") {
        const performer = await this.db.query.performers.findFirst({
          where: eq(performers.id, entityId),
        });
        if (performer?.stashdbId) {
          stashdbId = performer.stashdbId;
        }
      } else if (entityType === "studio") {
        const studio = await this.db.query.studios.findFirst({
          where: eq(studios.id, entityId),
        });
        if (studio?.stashdbId) {
          stashdbId = studio.stashdbId;
        }
      }

      // Get scene IDs from StashDB
      let sceneIds: string[] = [];

      if (entityType === "performer") {
        console.log(
          `[SubscriptionService] Fetching scenes from StashDB for performer ${stashdbId}`
        );
        const response = await this.stashdbClient.request<{
          findPerformer: { scenes: Array<{ id: string }> };
        }>(GET_PERFORMER_SCENES_QUERY, { id: stashdbId });

        sceneIds = response.findPerformer?.scenes?.map((s) => s.id) || [];
        console.log(
          `[SubscriptionService] Found ${sceneIds.length} scenes in StashDB for performer`
        );
      } else if (entityType === "studio") {
        console.log(
          `[SubscriptionService] Fetching scenes from StashDB for studio ${stashdbId}`
        );
        const response = await this.stashdbClient.request<{
          findStudio: { scenes: Array<{ id: string }> };
        }>(GET_STUDIO_SCENES_QUERY, { id: stashdbId });

        sceneIds = response.findStudio?.scenes?.map((s) => s.id) || [];
        console.log(
          `[SubscriptionService] Found ${sceneIds.length} scenes in StashDB for studio`
        );
      }

      // Fetch and save each scene with rate limiting
      // Process in batches of 3 to avoid overwhelming StashDB and reduce timeout risk
      const batchSize = 3;
      const delayBetweenBatches = 2000; // 2 seconds between batches

      console.log(
        `[SubscriptionService] Processing ${sceneIds.length} scenes in batches of ${batchSize}`
      );

      for (let i = 0; i < sceneIds.length; i += batchSize) {
        const batch = sceneIds.slice(i, i + batchSize);
        console.log(
          `[SubscriptionService] Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(sceneIds.length / batchSize)}`
        );

        await Promise.all(
          batch.map(async (sceneId) => {
            try {
              await this.fetchAndSaveScene(sceneId);
            } catch (error) {
              console.error(
                `[SubscriptionService] Failed to fetch scene ${sceneId}:`,
                error
              );
              // Continue with other scenes
            }
          })
        );

        // Wait between batches to avoid rate limiting
        if (i + batchSize < sceneIds.length) {
          console.log(
            `[SubscriptionService] Waiting ${delayBetweenBatches}ms before next batch...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, delayBetweenBatches)
          );
        }
      }

      console.log(
        `[SubscriptionService] Finished processing all scene batches`
      );
    } catch (error) {
      console.error(
        `[SubscriptionService] Failed to fetch scenes from StashDB for ${entityType} ${entityId}:`,
        error
      );
      // Don't throw - we want to continue even if StashDB fetch fails
    }
  }

  /**
   * Fetch a single scene from StashDB and save to database with retry logic
   */
  private async fetchAndSaveScene(sceneId: string, retries = 3): Promise<void> {
    if (!this.stashdbClient) {
      return;
    }

    try {
      // Check if scene already exists
      let existingScene = await this.db.query.scenes.findFirst({
        where: eq(scenes.stashdbId, sceneId),
      });

      let newSceneId: string;

      console.log(
        `[SubscriptionService] Fetching scene ${sceneId} from StashDB`
      );

      // Fetch scene details from StashDB with retry logic
      let response;
      let lastError;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          response = await this.stashdbClient.request<{
            findScene: {
              id: string;
              title: string;
              date?: string;
              details?: string;
              duration?: number;
              code?: string;
              director?: string;
              urls: Array<{ url: string }>;
              images: Array<{ url: string; width: number; height: number }>;
              studio?: { id: string; name: string };
              performers: Array<{
                performer: {
                  id: string;
                  name: string;
                  disambiguation?: string;
                };
              }>;
              tags: Array<{ id: string; name: string }>;
            };
          }>(GET_SCENE_QUERY, { id: sceneId });
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          if (attempt < retries) {
            const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
            console.log(
              `[SubscriptionService] Retry ${attempt}/${retries} for scene ${sceneId} after ${delay}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            throw error; // Max retries reached
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Failed to fetch scene after retries");
      }

      const sceneData = response.findScene;

      if (!sceneData) {
        return;
      }

      // Create scene record if it doesn't exist
      if (existingScene) {
        console.log(
          `[SubscriptionService] Scene "${sceneData.title}" already exists, updating relationships only`
        );
        newSceneId = existingScene.id;
      } else {
        newSceneId = nanoid();
        console.log(
          `[SubscriptionService] Saving scene "${sceneData.title}" to database`
        );
        await this.db.insert(scenes).values({
          id: newSceneId,
          stashdbId: sceneData.id,
          title: sceneData.title,
          date: sceneData.date || null,
          details: sceneData.details || null,
          duration: sceneData.duration || null,
          code: sceneData.code || null,
          director: sceneData.director || null,
          urls: sceneData.urls.map((u) => u.url),
          images: sceneData.images.map((img) => ({
            url: img.url,
            width: img.width,
            height: img.height,
          })),
          hasMetadata: true,
          inferredFromIndexers: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Link performers to scene
      if (sceneData.performers && sceneData.performers.length > 0) {
        for (const p of sceneData.performers) {
          // Ensure performer exists in database
          let performer = await this.db.query.performers.findFirst({
            where: eq(performers.stashdbId, p.performer.id),
          });

          if (!performer) {
            // Create performer if doesn't exist
            const performerId = nanoid();
            await this.db.insert(performers).values({
              id: performerId,
              stashdbId: p.performer.id,
              name: p.performer.name,
              aliases: [],
              disambiguation: p.performer.disambiguation || null,
              gender: null,
              birthdate: null,
              deathDate: null,
              careerStartDate: null,
              careerEndDate: null,
              images: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            performer = await this.db.query.performers.findFirst({
              where: eq(performers.id, performerId),
            });
          }

          if (performer) {
            // Link performer to scene
            console.log(
              `[SubscriptionService] Linking performer ${performer.id} (${p.performer.name}) to scene ${newSceneId}`
            );
            await this.db
              .insert(performersScenes)
              .values({
                performerId: performer.id,
                sceneId: newSceneId,
              })
              .onConflictDoNothing();
          }
        }
      }

      // Link studio to scene
      if (sceneData.studio) {
        let studio = await this.db.query.studios.findFirst({
          where: eq(studios.stashdbId, sceneData.studio.id),
        });

        if (!studio) {
          // Create studio if doesn't exist
          const studioId = nanoid();
          await this.db.insert(studios).values({
            id: studioId,
            stashdbId: sceneData.studio.id,
            name: sceneData.studio.name,
            aliases: [],
            parentStudioId: null,
            images: [],
            url: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          studio = await this.db.query.studios.findFirst({
            where: eq(studios.id, studioId),
          });
        }

        if (studio) {
          // Link studio to scene
          await this.db
            .insert(studiosScenes)
            .values({
              studioId: studio.id,
              sceneId: newSceneId,
            })
            .onConflictDoNothing();
        }
      }
    } catch (error) {
      console.error(
        `Failed to fetch and save scene ${sceneId} from StashDB:`,
        error
      );
      // Don't throw - continue with other scenes
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
   */
  async deleteSubscription(
    id: string,
    deleteAssociatedScenes: boolean = false
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
      `[SubscriptionService] Deleting subscription for ${subscription.entityType}: ${entityName} (subscription ID: ${id})`
    );

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
        subscription.entityId
      );
    }
  }

  /**
   * Delete all scene subscriptions for a performer or studio
   */
  private async deleteEntitySceneSubscriptions(
    entityType: "performer" | "studio",
    entityId: string
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

    // Delete subscriptions for each scene
    for (const scene of entityScenes) {
      await this.db
        .delete(subscriptions)
        .where(
          and(
            eq(subscriptions.entityType, "scene"),
            eq(subscriptions.entityId, scene.id)
          )
        );
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
   * Validate that entity exists
   * Reserved for future validation implementation
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _validateEntity(
    entityType: string,
    entityId: string
  ): Promise<void> {
    // Entity ID can be either a local ID or a StashDB ID
    // Check both possibilities

    let exists = false;

    switch (entityType) {
      case "performer":
        // Check by local ID first, then by stashdbId
        const performerById = await this.db.query.performers.findFirst({
          where: eq(performers.id, entityId),
        });

        const performerByStashId = await this.db.query.performers.findFirst({
          where: eq(performers.stashdbId, entityId),
        });

        exists = !!(performerById || performerByStashId);

        // If not found, check if it's a valid UUID (StashDB ID)
        // Accept it as valid - it will be fetched from StashDB when needed
        if (!exists) {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(entityId)) {
            exists = true; // Assume it's a valid StashDB ID
          }
        }
        break;

      case "studio":
        const studioById = await this.db.query.studios.findFirst({
          where: eq(studios.id, entityId),
        });

        const studioByStashId = await this.db.query.studios.findFirst({
          where: eq(studios.stashdbId, entityId),
        });

        exists = !!(studioById || studioByStashId);

        if (!exists) {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(entityId)) {
            exists = true;
          }
        }
        break;

      case "scene":
        const sceneById = await this.db.query.scenes.findFirst({
          where: eq(scenes.id, entityId),
        });

        const sceneByStashId = await this.db.query.scenes.findFirst({
          where: eq(scenes.stashdbId, entityId),
        });

        exists = !!(sceneById || sceneByStashId);

        if (!exists) {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(entityId)) {
            exists = true;
          }
        }
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
export function createSubscriptionService(db: any) {
  return new SubscriptionService(db);
}
// Test comment
