/**
 * Metadata Refresh Job
 * Re-queries TPDB for subscribed entities to update their metadata
 * Discovers new scenes for subscribed performers/studios
 * Creates folders and metadata files for scenes
 * Runs daily at 2 AM
 */

import type { FastifyInstance } from "fastify";
import { eq, isNull, or } from "drizzle-orm";
import { subscriptions, performers, studios, scenes } from "@repo/database";
import { nanoid } from "nanoid";

export async function metadataRefreshJob(app: FastifyInstance) {
  // Get services from DI container
  const { jobProgressService } = app.container;
  const progressService = jobProgressService;

  progressService.emitStarted("metadata-refresh", "Starting metadata refresh job");
  app.log.info("Starting metadata refresh job");

  try {
    // Get all active subscriptions
    const activeSubscriptions = await app.db.query.subscriptions.findMany({
      where: eq(subscriptions.isSubscribed, true),
    });

    const totalTasks = activeSubscriptions.length;

    progressService.emitProgress(
      "metadata-refresh",
      `Found ${activeSubscriptions.length} subscriptions`,
      0,
      totalTasks
    );

    app.log.info(
      `Found ${activeSubscriptions.length} active subscriptions`
    );

    let processedCount = 0;

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

    // Refresh performers
    if (performerIds.size > 0) {
      progressService.emitProgress(
        "metadata-refresh",
        `Refreshing ${performerIds.size} performers`,
        processedCount,
        totalTasks
      );
      await refreshPerformers(app, Array.from(performerIds));
      processedCount += performerIds.size;
    }

    // Refresh studios
    if (studioIds.size > 0) {
      progressService.emitProgress(
        "metadata-refresh",
        `Refreshing ${studioIds.size} studios`,
        processedCount,
        totalTasks
      );
      await refreshStudios(app, Array.from(studioIds));
      processedCount += studioIds.size;
    }

    // Discover new scenes for performers
    let discoveredScenes = 0;
    if (performerIds.size > 0) {
      progressService.emitProgress(
        "metadata-refresh",
        `Discovering new scenes for ${performerIds.size} performers`,
        processedCount,
        totalTasks
      );
      discoveredScenes += await discoverNewScenesForPerformers(
        app,
        Array.from(performerIds),
        progressService
      );
    }

    // Discover new scenes for studios
    if (studioIds.size > 0) {
      progressService.emitProgress(
        "metadata-refresh",
        `Discovering new scenes for ${studioIds.size} studios`,
        processedCount,
        totalTasks
      );
      discoveredScenes += await discoverNewScenesForStudios(
        app,
        Array.from(studioIds),
        progressService
      );
    }

    // Refresh subscribed scenes
    if (sceneIds.size > 0) {
      progressService.emitProgress(
        "metadata-refresh",
        `Refreshing ${sceneIds.size} subscribed scenes`,
        processedCount,
        totalTasks
      );
      await refreshScenes(app, Array.from(sceneIds), progressService, totalTasks, processedCount);
      processedCount += sceneIds.size;
    }

    // Create folders and metadata for subscribed scenes only
    const allScenesToProcess = sceneIds;

    if (allScenesToProcess.size > 0) {
      progressService.emitProgress(
        "metadata-refresh",
        `Creating folders and metadata for ${allScenesToProcess.size} scenes`,
        processedCount,
        totalTasks + allScenesToProcess.size
      );

      let folderCount = 0;

      // Get FileManagerService from container
      const { fileManagerService } = app.container;

      for (const sceneId of allScenesToProcess) {
        try {
          // Create folder structure with NFO and poster
          await fileManagerService.setupSceneFiles(sceneId);
          folderCount++;

          if (folderCount % 10 === 0) {
            progressService.emitProgress(
              "metadata-refresh",
              `Created ${folderCount}/${allScenesToProcess.size} scene folders`,
              processedCount + folderCount,
              totalTasks + allScenesToProcess.size
            );
          }
        } catch (error) {
          app.log.error(
            {
              error,
              sceneId,
              errorMessage: error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined
            },
            `Failed to create folder for scene ${sceneId}`
          );
        }
      }

      app.log.info(`Created folders for ${folderCount} scenes`);
    }

    progressService.emitCompleted(
      "metadata-refresh",
      `Completed: Refreshed ${totalTasks} items, discovered ${discoveredScenes} new scenes, created ${allScenesToProcess.size} folders`,
      { processedCount: totalTasks, discoveredScenes, foldersCreated: allScenesToProcess.size }
    );

    app.log.info("Metadata refresh job completed");
  } catch (error) {
    progressService.emitFailed(
      "metadata-refresh",
      `Metadata refresh job failed: ${error instanceof Error ? error.message : String(error)}`
    );
    app.log.error({ error }, "Metadata refresh job failed");
    throw error;
  }
}

async function refreshPerformers(
  app: FastifyInstance,
  performerIds: string[]
) {
  // TPDB doesn't support performer refresh yet
  // This functionality requires StashDB integration
  app.log.info(`Skipping ${performerIds.length} performers (TPDB-only mode)`);
}

async function refreshStudios(
  app: FastifyInstance,
  studioIds: string[]
) {
  // TPDB doesn't support studio refresh yet
  // This functionality requires StashDB integration
  app.log.info(`Skipping ${studioIds.length} studios (TPDB-only mode)`);
}

async function refreshScenes(
  app: FastifyInstance,
  sceneIds: string[],
  progressService: any,
  totalTasks: number,
  baseCount: number
) {
  const { settingsService } = app.container;
  const settings = await settingsService.getSettings();

  for (let i = 0; i < sceneIds.length; i++) {
    const id = sceneIds[i];
    try {
      // Get current scene data with file hashes
      const scene = await app.db.query.scenes.findFirst({
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
        app.log.warn(`Scene ${id} not found, skipping`);
        continue;
      }

      let metadata: any = null;
      let source: "tpdb" | "stashdb" | null = null;

      // STRATEGY 1: Use existing ID to refresh (subscribed scenes)
      if (!metadata) {
        const tpdbId = scene.externalIds.find(e => e.source === 'tpdb')?.id;
        if (tpdbId && settings.tpdb.enabled && app.container.tpdbService) {
          const contentType = scene.contentType || "scene";
          metadata = await app.container.tpdbService.getSceneById(tpdbId, contentType);
          source = "tpdb";
        }
        // StashDB support removed - TPDB-only mode
      }

      if (!metadata) {
        app.log.warn(`No metadata found for scene ${id}`);
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
        // Update externalIds with TPDB ID
        const existingIds = scene.externalIds.filter(e => e.source !== 'tpdb');
        updateData.externalIds = [...existingIds, { source: 'tpdb', id: metadata.id }];
        updateData.contentType = metadata.contentType || "scene";
      }

      await app.db.update(scenes).set(updateData).where(eq(scenes.id, id));

      progressService.emitProgress(
        "metadata-refresh",
        `Updated scene: ${scene.title}`,
        baseCount + i + 1,
        totalTasks,
        { entityName: scene.title, source }
      );
      app.log.info({ scene: scene.title, source }, `Updated metadata for scene`);
    } catch (error) {
      app.log.error(
        { error, sceneId: id },
        `Failed to refresh metadata for scene ${id}`
      );
    }
  }
}

/**
 * Discover new scenes for subscribed performers
 * Queries TPDB for all scenes of each performer and creates placeholder scenes for new ones
 */
async function discoverNewScenesForPerformers(
  app: FastifyInstance,
  performerIds: string[],
  progressService: any
): Promise<number> {
  const { settingsService } = app.container;
  const settings = await settingsService.getSettings();

  if (!settings.tpdb.enabled || !app.container.tpdbService) {
    app.log.info("TPDB not enabled, skipping performer scene discovery");
    return 0;
  }

  let totalDiscovered = 0;

  for (let i = 0; i < performerIds.length; i++) {
    const performerId = performerIds[i];

    // Add delay to avoid TPDB rate limiting (1 second between requests)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
      // Get performer details
      const performer = await app.db.query.performers.findFirst({
        where: eq(performers.id, performerId),
      });

      if (!performer) {
        app.log.warn(`Performer ${performerId} not found, skipping discovery`);
        continue;
      }

      // Check if performer has a TPDB ID
      const tpdbId = performer.externalIds?.find(e => e.source === 'tpdb')?.id;
      if (!tpdbId) {
        app.log.debug(`Performer ${performer.name} has no TPDB ID, skipping discovery`);
        continue;
      }

      // Query TPDB for performer's scenes
      const tpdbService = app.container.tpdbService;
      const performerScenes = await tpdbService.getScenesByPerformer(tpdbId);

      if (!performerScenes || performerScenes.length === 0) {
        app.log.debug(`No scenes found for performer ${performer.name} in TPDB`);
        continue;
      }

      // Find scenes that don't exist in our database
      let newScenesCreated = 0;
      for (const tpdbScene of performerScenes) {
        // Check if scene already exists by TPDB ID
        const existingScene = await app.db.query.scenes.findFirst({
          where: eq(scenes.id, tpdbScene.id),
        });

        if (existingScene) {
          continue;
        }

        // Check if scene exists by external ID
        const existingByExternalId = await app.db.query.scenes.findFirst({
          where: eq(scenes.externalIds, {
            source: 'tpdb',
            id: tpdbScene.id,
          }),
        });

        if (existingByExternalId) {
          continue;
        }

        // Create new placeholder scene
        const newSceneId = nanoid();
        await app.db.insert(scenes).values({
          id: newSceneId,
          slug: tpdbScene.title?.toLowerCase().replace(/\s+/g, "-") || `tpdb-${tpdbScene.id}`,
          title: tpdbScene.title || "Unknown Title",
          date: tpdbScene.date || null,
          duration: tpdbScene.duration || null,
          code: tpdbScene.code || null,
          images: tpdbScene.images || [],
          hasMetadata: true, // Has metadata from TPDB
          externalIds: [{ source: 'tpdb', id: tpdbScene.id }],
          contentType: tpdbScene.type || "scene",
          inferredFromIndexers: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        newScenesCreated++;
        totalDiscovered++;

        app.log.info(
          { sceneId: newSceneId, tpdbId: tpdbScene.id, title: tpdbScene.title },
          `Discovered new scene for performer ${performer.name}`
        );
      }

      if (newScenesCreated > 0) {
        app.log.info(
          `Discovered ${newScenesCreated} new scenes for performer ${performer.name}`
        );
        progressService.emitProgress(
          "metadata-refresh",
          `Discovered ${newScenesCreated} new scenes for ${performer.name}`,
          i + 1,
          performerIds.length,
          { performerName: performer.name, newScenes: newScenesCreated }
        );
      }
    } catch (error) {
      app.log.error(
        { error, performerId },
        `Failed to discover scenes for performer ${performerId}`
      );
    }
  }

  return totalDiscovered;
}

/**
 * Discover new scenes for subscribed studios
 * Queries TPDB for all scenes of each studio and creates placeholder scenes for new ones
 */
async function discoverNewScenesForStudios(
  app: FastifyInstance,
  studioIds: string[],
  progressService: any
): Promise<number> {
  const { settingsService } = app.container;
  const settings = await settingsService.getSettings();

  if (!settings.tpdb.enabled || !app.container.tpdbService) {
    app.log.info("TPDB not enabled, skipping studio scene discovery");
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
      // Get studio details
      const studio = await app.db.query.studios.findFirst({
        where: eq(studios.id, studioId),
      });

      if (!studio) {
        app.log.warn(`Studio ${studioId} not found, skipping discovery`);
        continue;
      }

      // Check if studio has a TPDB ID
      const tpdbId = studio.externalIds?.find(e => e.source === 'tpdb')?.id;
      if (!tpdbId) {
        app.log.debug(`Studio ${studio.name} has no TPDB ID, skipping discovery`);
        continue;
      }

      // Query TPDB for studio's scenes
      const tpdbService = app.container.tpdbService;
      const studioScenes = await tpdbService.getScenesByStudio(tpdbId);

      if (!studioScenes || studioScenes.length === 0) {
        app.log.debug(`No scenes found for studio ${studio.name} in TPDB`);
        continue;
      }

      // Find scenes that don't exist in our database
      let newScenesCreated = 0;
      for (const tpdbScene of studioScenes) {
        // Check if scene already exists
        const existingScene = await app.db.query.scenes.findFirst({
          where: eq(scenes.id, tpdbScene.id),
        });

        if (existingScene) {
          continue;
        }

        // Create new placeholder scene
        const newSceneId = nanoid();
        await app.db.insert(scenes).values({
          id: newSceneId,
          slug: tpdbScene.title?.toLowerCase().replace(/\s+/g, "-") || `tpdb-${tpdbScene.id}`,
          title: tpdbScene.title || "Unknown Title",
          date: tpdbScene.date || null,
          duration: tpdbScene.duration || null,
          code: tpdbScene.code || null,
          images: tpdbScene.images || [],
          hasMetadata: true,
          externalIds: [{ source: 'tpdb', id: tpdbScene.id }],
          contentType: tpdbScene.type || "scene",
          inferredFromIndexers: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        newScenesCreated++;
        totalDiscovered++;

        app.log.info(
          { sceneId: newSceneId, tpdbId: tpdbScene.id, title: tpdbScene.title },
          `Discovered new scene for studio ${studio.name}`
        );
      }

      if (newScenesCreated > 0) {
        app.log.info(
          `Discovered ${newScenesCreated} new scenes for studio ${studio.name}`
        );
        progressService.emitProgress(
          "metadata-refresh",
          `Discovered ${newScenesCreated} new scenes for ${studio.name}`,
          i + 1,
          studioIds.length,
          { studioName: studio.name, newScenes: newScenesCreated }
        );
      }
    } catch (error) {
      app.log.error(
        { error, studioId },
        `Failed to discover scenes for studio ${studioId}`
      );
    }
  }

  return totalDiscovered;
}
