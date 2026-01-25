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
import type { IMetadataProvider } from "@/infrastructure/adapters/interfaces/metadata-provider.interface.js";
import type { FileManagerService } from "../../application/services/file-management/file-manager.service.js";
import type { SettingsService } from "../../application/services/settings.service.js";
import type { Database } from "@repo/database";
import { eq } from "drizzle-orm";
import { subscriptions, scenes } from "@repo/database";
import { nanoid } from "nanoid";

export class MetadataRefreshJob extends BaseJob {
  readonly name = "metadata-refresh";
  readonly description = "Update and fix missing metadata for scenes from TPDB";

  private subscriptionsRepository: SubscriptionsRepository;
  private performersRepository: PerformersRepository;
  private studiosRepository: StudiosRepository;
  private scenesRepository: ScenesRepository;
  private tpdbProvider: IMetadataProvider | undefined;
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
    tpdbProvider: IMetadataProvider | undefined;
    fileManager: FileManagerService;
    settingsService: SettingsService;
    db: Database;
  }) {
    super(deps);
    this.subscriptionsRepository = deps.subscriptionsRepository;
    this.performersRepository = deps.performersRepository;
    this.studiosRepository = deps.studiosRepository;
    this.scenesRepository = deps.scenesRepository;
    this.tpdbProvider = deps.tpdbProvider;
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
    const settings = await this.settingsService.getSettings();

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
        let source: "tpdb" | null = null;

        // Use existing ID to refresh (subscribed scenes)
        if (!metadata) {
          const tpdbId = scene.externalIds?.find(e => e.source === 'tpdb')?.id;
          if (tpdbId && settings.tpdb.enabled && this.tpdbProvider) {
            metadata = await this.tpdbProvider.getSceneById(tpdbId);
            source = "tpdb";
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

        if (source === "tpdb" && metadata.id) {
          const existingIds = scene.externalIds.filter(e => e.source !== 'tpdb');
          updateData.externalIds = [...existingIds, { source: 'tpdb', id: metadata.id }];
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
    const settings = await this.settingsService.getSettings();

    if (!settings.tpdb.enabled || !this.tpdbProvider) {
      this.logger.info("TPDB not enabled, skipping performer scene discovery");
      return 0;
    }

    let totalDiscovered = 0;

    for (let i = 0; i < performerIds.length; i++) {
      const performerId = performerIds[i];

      // Add delay to avoid TPDB rate limiting
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

        const tpdbId = performer.externalIds?.find(e => e.source === 'tpdb')?.id;
        if (!tpdbId) {
          this.logger.debug(`Performer ${performer.name} has no TPDB ID, skipping discovery`);
          continue;
        }

        const result = this.tpdbProvider.getPerformerScenes
          ? await this.tpdbProvider.getPerformerScenes(tpdbId, "scene", 1)
          : undefined;
        const performerScenes = result?.scenes || [];

        if (!performerScenes || performerScenes.length === 0) {
          this.logger.debug(`No scenes found for performer ${performer.name} in TPDB`);
          continue;
        }

        let newScenesCreated = 0;
        for (const tpdbScene of performerScenes) {
          const existingScene = await this.db.query.scenes.findFirst({
            where: eq(scenes.id, tpdbScene.id),
          });

          if (existingScene) {
            continue;
          }

          const newSceneId = nanoid();
          await this.db.insert(scenes).values({
            id: newSceneId,
            slug: tpdbScene.title?.toLowerCase().replace(/\s+/g, "-") || `tpdb-${tpdbScene.id}`,
            title: tpdbScene.title || "Unknown Title",
            date: tpdbScene.date || null,
            duration: tpdbScene.duration || null,
            code: tpdbScene.code || null,
            images: tpdbScene.images || [],
            hasMetadata: true,
            externalIds: [{ source: 'tpdb', id: tpdbScene.id }],
            contentType: tpdbScene.contentType || "scene",
            inferredFromIndexers: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          newScenesCreated++;
          totalDiscovered++;

          this.logger.info(
            { sceneId: newSceneId, tpdbId: tpdbScene.id, title: tpdbScene.title },
            `Discovered new scene for performer ${performer.name}`
          );
        }

        if (newScenesCreated > 0) {
          this.logger.info(
            `Discovered ${newScenesCreated} new scenes for performer ${performer.name}`
          );
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
    const settings = await this.settingsService.getSettings();

    if (!settings.tpdb.enabled || !this.tpdbProvider) {
      this.logger.info("TPDB not enabled, skipping studio scene discovery");
      return 0;
    }

    let totalDiscovered = 0;

    for (let i = 0; i < studioIds.length; i++) {
      const studioId = studioIds[i];

      // Add delay to avoid TPDB rate limiting
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

        const tpdbId = studio.externalIds?.find(e => e.source === 'tpdb')?.id;
        if (!tpdbId) {
          this.logger.debug(`Studio ${studio.name} has no TPDB ID, skipping discovery`);
          continue;
        }

        const result = this.tpdbProvider.getStudioScenes
          ? await this.tpdbProvider.getStudioScenes(tpdbId, "scene", 1)
          : undefined;
        const studioScenes = result?.scenes || [];

        if (!studioScenes || studioScenes.length === 0) {
          this.logger.debug(`No scenes found for studio ${studio.name} in TPDB`);
          continue;
        }

        let newScenesCreated = 0;
        for (const tpdbScene of studioScenes) {
          const existingScene = await this.db.query.scenes.findFirst({
            where: eq(scenes.id, tpdbScene.id),
          });

          if (existingScene) {
            continue;
          }

          const newSceneId = nanoid();
          await this.db.insert(scenes).values({
            id: newSceneId,
            slug: tpdbScene.title?.toLowerCase().replace(/\s+/g, "-") || `tpdb-${tpdbScene.id}`,
            title: tpdbScene.title || "Unknown Title",
            date: tpdbScene.date || null,
            duration: tpdbScene.duration || null,
            code: tpdbScene.code || null,
            images: tpdbScene.images || [],
            hasMetadata: true,
            externalIds: [{ source: 'tpdb', id: tpdbScene.id }],
            contentType: tpdbScene.contentType || "scene",
            inferredFromIndexers: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          newScenesCreated++;
          totalDiscovered++;

          this.logger.info(
            { sceneId: newSceneId, tpdbId: tpdbScene.id, title: tpdbScene.title },
            `Discovered new scene for studio ${studio.name}`
          );
        }

        if (newScenesCreated > 0) {
          this.logger.info(
            `Discovered ${newScenesCreated} new scenes for studio ${studio.name}`
          );
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
