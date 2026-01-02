/**
 * Metadata Refresh Job
 * Re-queries StashDB for subscribed entities to update their metadata
 * Also discovers and fixes scenes with missing metadata
 * Creates folders and metadata files for scenes
 * Runs daily at 2 AM
 */

import type { FastifyInstance } from "fastify";
import { eq, isNull, or } from "drizzle-orm";
import { subscriptions, performers, studios, scenes } from "@repo/database";

export async function metadataRefreshJob(app: FastifyInstance) {
  // Get services from DI container
  const { jobProgressService } = app.container;
  const progressService = jobProgressService;

  progressService.emitStarted("metadata-refresh", "Starting metadata refresh job");
  app.log.info("Starting metadata refresh job");

  try {
    // Get all active subscriptions
    const activeSubscriptions = await app.db.query.subscriptions.findMany({
      where: eq(subscriptions.status, "active"),
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
      `Completed: Refreshed ${totalTasks} items and created ${allScenesToProcess.size} folders`,
      { processedCount: totalTasks, foldersCreated: allScenesToProcess.size }
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

      // STRATEGY 1: Hash-based lookup (TPDB only, most accurate)
      if (settings.metadata.hashLookupEnabled && settings.tpdb.enabled && app.container.tpdbService) {
        metadata = await tryHashLookup(app, scene);
        if (metadata) {
          source = "tpdb";
          app.log.info({ sceneId: id, method: "hash" }, "Found metadata via hash");
        }
      }

      // STRATEGY 2: Use existing ID to refresh (subscribed scenes)
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

async function tryHashLookup(app: FastifyInstance, scene: any) {
  if (!scene.sceneFiles || scene.sceneFiles.length === 0) return null;
  if (!app.container.tpdbService) return null;

  for (const file of scene.sceneFiles) {
    if (!file.fileHashes || file.fileHashes.length === 0) continue;

    const hashes = file.fileHashes[0];

    // Try OSHASH first
    if (hashes.oshash) {
      try {
        const result = await app.container.tpdbService.getSceneByHash(hashes.oshash, "OSHASH");
        if (result) {
          app.log.info({ oshash: hashes.oshash, tpdbId: result.id }, "Found via OSHASH");
          return result;
        }
      } catch (error) {
        app.log.debug({ error }, "OSHASH lookup failed");
      }
    }

    // Fallback to PHASH
    if (hashes.phash) {
      try {
        const result = await app.container.tpdbService.getSceneByHash(hashes.phash, "PHASH");
        if (result) {
          app.log.info({ phash: hashes.phash, tpdbId: result.id }, "Found via PHASH");
          return result;
        }
      } catch (error) {
        app.log.debug({ error }, "PHASH lookup failed");
      }
    }
  }

  return null;
}
