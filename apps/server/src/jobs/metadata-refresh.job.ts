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
import { getJobProgressService } from "../services/job-progress.service.js";

export async function metadataRefreshJob(app: FastifyInstance) {
  const progressService = getJobProgressService();

  progressService.emitStarted("metadata-refresh", "Starting metadata refresh job");
  app.log.info("Starting metadata refresh job");

  try {
    // Get all active subscriptions
    const activeSubscriptions = await app.db.query.subscriptions.findMany({
      where: eq(subscriptions.status, "active"),
    });

    // Find scenes with missing or incomplete metadata
    const scenesWithMissingMetadata = await app.db.query.scenes.findMany({
      where: or(
        isNull(scenes.details),
        isNull(scenes.duration),
        isNull(scenes.director)
      ),
    });

    const totalTasks = activeSubscriptions.length + scenesWithMissingMetadata.length;

    progressService.emitProgress(
      "metadata-refresh",
      `Found ${activeSubscriptions.length} subscriptions and ${scenesWithMissingMetadata.length} scenes with missing metadata`,
      0,
      totalTasks
    );

    app.log.info(
      `Found ${activeSubscriptions.length} active subscriptions and ${scenesWithMissingMetadata.length} scenes with missing metadata`
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
      await refreshPerformers(app, Array.from(performerIds), progressService, totalTasks, processedCount);
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
      await refreshStudios(app, Array.from(studioIds), progressService, totalTasks, processedCount);
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

    // Fix scenes with missing metadata
    if (scenesWithMissingMetadata.length > 0) {
      progressService.emitProgress(
        "metadata-refresh",
        `Fixing ${scenesWithMissingMetadata.length} scenes with missing metadata`,
        processedCount,
        totalTasks
      );
      const missingSceneIds = scenesWithMissingMetadata.map(s => s.id);
      await refreshScenes(app, missingSceneIds, progressService, totalTasks, processedCount);
      processedCount += missingSceneIds.length;
    }

    // Create folders and metadata for all scenes (subscribed or with missing metadata)
    const allScenesToProcess = new Set([...Array.from(sceneIds), ...scenesWithMissingMetadata.map(s => s.id)]);

    if (allScenesToProcess.size > 0) {
      progressService.emitProgress(
        "metadata-refresh",
        `Creating folders and metadata for ${allScenesToProcess.size} scenes`,
        processedCount,
        totalTasks + allScenesToProcess.size
      );

      let folderCount = 0;

      // Debug: Check if fileManager is available
      app.log.info({
        hasFileManager: !!app.fileManager,
        fileManagerType: typeof app.fileManager,
        fileManagerKeys: app.fileManager ? Object.keys(app.fileManager) : []
      }, "FileManager availability check");

      for (const sceneId of allScenesToProcess) {
        try {
          // Create folder structure with NFO and poster
          await app.fileManager.setupSceneFiles(sceneId);
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
  performerIds: string[],
  progressService: any,
  totalTasks: number,
  baseCount: number
) {
  // TPDB doesn't support performer refresh yet
  // This functionality requires StashDB integration
  app.log.info(`Skipping ${performerIds.length} performers (TPDB-only mode)`);
}

async function refreshStudios(
  app: FastifyInstance,
  studioIds: string[],
  progressService: any,
  totalTasks: number,
  baseCount: number
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
  const { createSettingsService } = await import("../services/settings.service.js");
  const settingsService = createSettingsService(app.db);
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
      if (settings.metadata.hashLookupEnabled && settings.tpdb.enabled && app.tpdb) {
        metadata = await tryHashLookup(app, scene);
        if (metadata) {
          source = "tpdb";
          app.log.info({ sceneId: id, method: "hash" }, "Found metadata via hash");
        }
      }

      // STRATEGY 2: Use existing ID to refresh (subscribed scenes)
      if (!metadata) {
        if (scene.tpdbId && settings.tpdb.enabled && app.tpdb) {
          const contentType = scene.tpdbContentType || "scene";
          metadata = await app.tpdb.getSceneById(scene.tpdbId, contentType);
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
        details: metadata.details,
        duration: metadata.duration,
        director: metadata.director,
        code: metadata.code,
        urls: metadata.urls || [],
        images: metadata.images || [],
        hasMetadata: true,
        updatedAt: new Date().toISOString(),
      };

      if (source === "tpdb") {
        updateData.tpdbId = metadata.id || metadata.tpdbId;
        updateData.tpdbContentType = metadata.tpdbContentType || null;
      } else {
        updateData.stashdbId = metadata.id;
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

  for (const file of scene.sceneFiles) {
    if (!file.fileHashes || file.fileHashes.length === 0) continue;

    const hashes = file.fileHashes[0];

    // Try OSHASH first
    if (hashes.oshash) {
      try {
        const result = await app.tpdb.getSceneByHash(hashes.oshash, "OSHASH");
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
        const result = await app.tpdb.getSceneByHash(hashes.phash, "PHASH");
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
