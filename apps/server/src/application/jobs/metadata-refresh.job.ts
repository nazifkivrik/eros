/**
 * Metadata Refresh Job
 * Re-queries TPDB for subscribed entities to update their metadata
 * Discovers new scenes for subscribed performers/studios
 * Creates folders and metadata files for scenes
 * Runs daily at 2 AM
 */

import { BaseJob } from "./base.job.js";
import type { Logger } from "pino";
import type { JobProgressService } from "@/infrastructure/job-progress.service.js";
import type { SubscriptionsRepository } from "@/infrastructure/repositories/subscriptions.repository.js";
import type { PerformersRepository } from "@/infrastructure/repositories/performers.repository.js";
import type { StudiosRepository } from "@/infrastructure/repositories/studios.repository.js";
import type { ScenesRepository } from "@/infrastructure/repositories/scenes.repository.js";
import type { FileManagerService } from "../../application/services/file-management/file-manager.service.js";
import type { SettingsService } from "../../application/services/settings.service.js";
import type { Database } from "@repo/database";
import { eq } from "drizzle-orm";
import { subscriptions, scenes } from "@repo/database";
import { nanoid } from "nanoid";
import type { MetadataProviderRegistry } from "@/infrastructure/registries/provider-registry.js";

export class MetadataRefreshJob extends BaseJob {
  readonly name = "metadata-refresh";
  readonly description = "Update and fix missing metadata for scenes from metadata providers";

  private subscriptionsRepository: SubscriptionsRepository;
  private performersRepository: PerformersRepository;
  private studiosRepository: StudiosRepository;
  private scenesRepository: ScenesRepository;
  private metadataRegistry: MetadataProviderRegistry;
  private fileManager: FileManagerService;
  private settingsService: SettingsService;
  private db: Database;

  constructor(deps: {
    logger: Logger;
    jobProgressService: JobProgressService;
    subscriptionsRepository: SubscriptionsRepository;
    performersRepository: PerformersRepository;
    studiosRepository: StudiosRepository;
    scenesRepository: ScenesRepository;
    metadataRegistry: MetadataProviderRegistry;
    fileManager: FileManagerService;
    settingsService: SettingsService;
    db: Database;
  }) {
    super(deps);
    this.subscriptionsRepository = deps.subscriptionsRepository;
    this.performersRepository = deps.performersRepository;
    this.studiosRepository = deps.studiosRepository;
    this.scenesRepository = deps.scenesRepository;
    this.metadataRegistry = deps.metadataRegistry;
    this.fileManager = deps.fileManager;
    this.settingsService = deps.settingsService;
    this.db = deps.db;
  }

  async execute(): Promise<void> {
    this.emitStarted("Starting metadata refresh job");
    this.logger.info("Starting metadata refresh job");

    try {
      // Get all active subscriptions
      const activeSubscriptions = await this.db.query.subscriptions.findMany({
        where: eq(subscriptions.isSubscribed, true),
      });

      const totalTasks = activeSubscriptions.length;

      this.emitProgress(
        `Found ${activeSubscriptions.length} subscriptions`,
        0,
        totalTasks
      );

      this.logger.info(`Found ${activeSubscriptions.length} active subscriptions`);

      let processedCount = 0;
      let discoveredScenes = 0;

      // Group subscriptions by entity type
      const performerIds = new Set<string>();
      const studioIds = new Set<string>();
      const sceneIds = new Set<string>();

      for (const sub of activeSubscriptions) {
        if (sub.entityType === "performer") {
          performerIds.add(sub.entityId);
        } else if (sub.entityType === "studio") {
          studioIds.add(sub.entityId);
        } else if (sub.entityType === "scene") {
          sceneIds.add(sub.entityId);
        }
      }

      // Refresh performers (currently no-op, TPDB-only mode)
      if (performerIds.size > 0) {
        this.emitProgress(
          `Refreshing ${performerIds.size} performers`,
          processedCount,
          totalTasks
        );
        this.logger.info(`Skipping ${performerIds.size} performers (TPDB-only mode)`);
        processedCount += performerIds.size;
      }

      // Refresh studios (currently no-op, TPDB-only mode)
      if (studioIds.size > 0) {
        this.emitProgress(
          `Refreshing ${studioIds.size} studios`,
          processedCount,
          totalTasks
        );
        this.logger.info(`Skipping ${studioIds.size} studios (TPDB-only mode)`);
        processedCount += studioIds.size;
      }

      // Discover new scenes for performers
      if (performerIds.size > 0) {
        this.emitProgress(
          `Discovering new scenes for ${performerIds.size} performers`,
          processedCount,
          totalTasks
        );
        discoveredScenes += await this.discoverNewScenesForPerformers(
          Array.from(performerIds)
        );
      }

      // Discover new scenes for studios
      if (studioIds.size > 0) {
        this.emitProgress(
          `Discovering new scenes for ${studioIds.size} studios`,
          processedCount,
          totalTasks
        );
        discoveredScenes += await this.discoverNewScenesForStudios(
          Array.from(studioIds)
        );
      }

      // Refresh subscribed scenes
      if (sceneIds.size > 0) {
        this.emitProgress(
          `Refreshing ${sceneIds.size} subscribed scenes`,
          processedCount,
          totalTasks
        );
        await this.refreshScenes(Array.from(sceneIds), totalTasks, processedCount);
        processedCount += sceneIds.size;
      }

      // Create folders and metadata for subscribed scenes
      if (sceneIds.size > 0) {
        this.emitProgress(
          `Creating folders and metadata for ${sceneIds.size} scenes`,
          processedCount,
          totalTasks + sceneIds.size
        );

        let folderCount = 0;
        for (const sceneId of sceneIds) {
          try {
            await this.fileManager.setupSceneFiles(sceneId);
            folderCount++;

            if (folderCount % 10 === 0) {
              this.emitProgress(
                `Created ${folderCount}/${sceneIds.size} scene folders`,
                processedCount + folderCount,
                totalTasks + sceneIds.size
              );
            }
          } catch (error) {
            this.logger.error(
              { error, sceneId },
              `Failed to create folder for scene ${sceneId}`
            );
          }
        }

        this.logger.info(`Created folders for ${folderCount} scenes`);
      }

      this.emitCompleted(
        `Completed: Refreshed ${totalTasks} items, discovered ${discoveredScenes} new scenes, created ${sceneIds.size} folders`,
        { processedCount: totalTasks, discoveredScenes, foldersCreated: sceneIds.size }
      );

      this.logger.info("Metadata refresh job completed");
    } catch (error) {
      this.emitFailed(
        `Metadata refresh job failed: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error({ error }, "Metadata refresh job failed");
      throw error;
    }
  }

  private async refreshScenes(
    sceneIds: string[],
    totalTasks: number,
    baseCount: number
  ): Promise<void> {
    const availableProviders = this.metadataRegistry.getAvailable();

    for (let i = 0; i < sceneIds.length; i++) {
      const id = sceneIds[i];
      try {
        // Get current scene data with file hashes
        const scene = await this.db.query.scenes.findFirst({
          where: eq(scenes.id, id),
          with: {
            sceneFiles: {
              with: {
                fileHashes: true,
              },
            },
          },
        });

        if (!scene) {
          this.logger.warn(`Scene ${id} not found, skipping`);
          continue;
        }

        let metadata: any = null;
        let source: string | null = null;
        let providerId: string | null = null;

        // Try each provider based on external IDs
        for (const externalId of scene.externalIds || []) {
          const provider = availableProviders.find(p => p.id.includes(externalId.source));
          if (provider) {
            try {
              metadata = await provider.provider.getSceneById(externalId.id);
              source = externalId.source;
              providerId = provider.id;
              break;
            } catch (error) {
              this.logger.debug({ error, providerId: provider.id, externalId: externalId.id }, `Failed to fetch scene from provider`);
            }
          }
        }

        if (!metadata) {
          this.logger.warn(`No metadata found for scene ${id}`);
          continue;
        }

        // Update scene with metadata
        const updateData: any = {
          title: metadata.title,
          date: metadata.date,
          duration: metadata.duration,
          code: metadata.code,
          images: metadata.images || [],
          hasMetadata: true,
          updatedAt: new Date().toISOString(),
        };

        if (source && metadata.id) {
          const existingIds = scene.externalIds.filter(e => e.source !== source);
          updateData.externalIds = [...existingIds, { source, id: metadata.id }];
          updateData.contentType = metadata.contentType || "scene";
        }

        await this.db.update(scenes).set(updateData).where(eq(scenes.id, id));

        this.emitProgress(
          `Updated scene: ${scene.title}`,
          baseCount + i + 1,
          totalTasks,
          { entityName: scene.title, source }
        );
        this.logger.info({ scene: scene.title, source }, `Updated metadata for scene`);
      } catch (error) {
        this.logger.error(
          { error, sceneId: id },
          `Failed to refresh metadata for scene ${id}`
        );
      }
    }
  }

  private async discoverNewScenesForPerformers(
    performerIds: string[]
  ): Promise<number> {
    const availableProviders = this.metadataRegistry.getAvailable();

    if (availableProviders.length === 0) {
      this.logger.info("No metadata providers available, skipping performer scene discovery");
      return 0;
    }

    let totalDiscovered = 0;

    for (let i = 0; i < performerIds.length; i++) {
      const performerId = performerIds[i];

      // Add delay to avoid rate limiting
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        const performer = await this.db.query.performers.findFirst({
          where: eq(scenes.id, performerId),
        });

        if (!performer) {
          this.logger.warn(`Performer ${performerId} not found, skipping discovery`);
          continue;
        }

        let discoveredForPerformer = false;

        // Try each provider
        for (const { id: providerId, provider } of availableProviders) {
          // Find external ID for this provider
          const providerSource = providerId.includes('tpdb') ? 'tpdb' : 'stashdb';
          const externalId = performer.externalIds?.find(e => e.source === providerSource)?.id;

          if (!externalId) {
            continue;
          }

          // Check if provider supports getPerformerScenes
          if (!('getPerformerScenes' in provider)) {
            continue;
          }

          try {
            const result = await provider.getPerformerScenes(externalId, "scene", 1);
            const performerScenes = result?.scenes || [];

            if (!performerScenes || performerScenes.length === 0) {
              this.logger.debug(`No scenes found for performer ${performer.name} in ${providerId}`);
              continue;
            }

            let newScenesCreated = 0;
            for (const providerScene of performerScenes) {
              const existingScene = await this.db.query.scenes.findFirst({
                where: eq(scenes.id, providerScene.id),
              });

              if (existingScene) {
                continue;
              }

              const newSceneId = nanoid();
              await this.db.insert(scenes).values({
                id: newSceneId,
                slug: providerScene.title?.toLowerCase().replace(/\s+/g, "-") || `${providerSource}-${providerScene.id}`,
                title: providerScene.title || "Unknown Title",
                date: providerScene.date || null,
                duration: providerScene.duration || null,
                code: providerScene.code || null,
                images: providerScene.images || [],
                hasMetadata: true,
                externalIds: [{ source: providerSource, id: providerScene.id }],
                contentType: providerScene.contentType || "scene",
                inferredFromIndexers: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });

              newScenesCreated++;
              totalDiscovered++;

              this.logger.info(
                { sceneId: newSceneId, providerId, externalId: providerScene.id, title: providerScene.title },
                `Discovered new scene for performer ${performer.name}`
              );
            }

            if (newScenesCreated > 0) {
              this.logger.info(
                `Discovered ${newScenesCreated} new scenes for performer ${performer.name} from ${providerId}`
              );
              discoveredForPerformer = true;
              break; // Use first successful provider
            }
          } catch (error) {
            this.logger.debug(
              { error, providerId, performerId },
              `Failed to discover scenes from ${providerId}`
            );
          }
        }

        if (!discoveredForPerformer) {
          this.logger.debug(`No scenes discovered for performer ${performer.name}`);
        }
      } catch (error) {
        this.logger.error(
          { error, performerId },
          `Failed to discover scenes for performer ${performerId}`
        );
      }
    }

    return totalDiscovered;
  }

  private async discoverNewScenesForStudios(
    studioIds: string[]
  ): Promise<number> {
    const availableProviders = this.metadataRegistry.getAvailable();

    if (availableProviders.length === 0) {
      this.logger.info("No metadata providers available, skipping studio scene discovery");
      return 0;
    }

    let totalDiscovered = 0;

    for (let i = 0; i < studioIds.length; i++) {
      const studioId = studioIds[i];

      // Add delay to avoid rate limiting
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        const studio = await this.db.query.studios.findFirst({
          where: eq(scenes.id, studioId),
        });

        if (!studio) {
          this.logger.warn(`Studio ${studioId} not found, skipping discovery`);
          continue;
        }

        let discoveredForStudio = false;

        // Try each provider
        for (const { id: providerId, provider } of availableProviders) {
          // Find external ID for this provider
          const providerSource = providerId.includes('tpdb') ? 'tpdb' : 'stashdb';
          const externalId = studio.externalIds?.find(e => e.source === providerSource)?.id;

          if (!externalId) {
            continue;
          }

          // Check if provider supports getStudioScenes
          if (!('getStudioScenes' in provider)) {
            continue;
          }

          try {
            const result = await provider.getStudioScenes(externalId, "scene", 1);
            const studioScenes = result?.scenes || [];

            if (!studioScenes || studioScenes.length === 0) {
              this.logger.debug(`No scenes found for studio ${studio.name} in ${providerId}`);
              continue;
            }

            let newScenesCreated = 0;
            for (const providerScene of studioScenes) {
              const existingScene = await this.db.query.scenes.findFirst({
                where: eq(scenes.id, providerScene.id),
              });

              if (existingScene) {
                continue;
              }

              const newSceneId = nanoid();
              await this.db.insert(scenes).values({
                id: newSceneId,
                slug: providerScene.title?.toLowerCase().replace(/\s+/g, "-") || `${providerSource}-${providerScene.id}`,
                title: providerScene.title || "Unknown Title",
                date: providerScene.date || null,
                duration: providerScene.duration || null,
                code: providerScene.code || null,
                images: providerScene.images || [],
                hasMetadata: true,
                externalIds: [{ source: providerSource, id: providerScene.id }],
                contentType: providerScene.contentType || "scene",
                inferredFromIndexers: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });

              newScenesCreated++;
              totalDiscovered++;

              this.logger.info(
                { sceneId: newSceneId, providerId, externalId: providerScene.id, title: providerScene.title },
                `Discovered new scene for studio ${studio.name}`
              );
            }

            if (newScenesCreated > 0) {
              this.logger.info(
                `Discovered ${newScenesCreated} new scenes for studio ${studio.name} from ${providerId}`
              );
              discoveredForStudio = true;
              break; // Use first successful provider
            }
          } catch (error) {
            this.logger.debug(
              { error, providerId, studioId },
              `Failed to discover scenes from ${providerId}`
            );
          }
        }

        if (!discoveredForStudio) {
          this.logger.debug(`No scenes discovered for studio ${studio.name}`);
        }
      } catch (error) {
        this.logger.error(
          { error, studioId },
          `Failed to discover scenes for studio ${studioId}`
        );
      }
    }

    return totalDiscovered;
  }
}
