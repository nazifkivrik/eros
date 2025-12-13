/**
 * Filesystem Sync Job
 * Scans filesystem for missing scenes and handles according to settings
 * Runs every 30 minutes
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { sceneFiles, sceneExclusions } from "@repo/database";
import { createFileManagerService } from "../services/file-manager.service.js";
import { createLogsService } from "../services/logs.service.js";
import { createSettingsService } from "../services/settings.service.js";

export async function filesystemSyncJob(app: FastifyInstance) {
  app.log.info("Starting filesystem sync job");

  try {
    const settingsService = createSettingsService(app.db);
    const settings = await settingsService.getSettings();
    const fileManager = createFileManagerService(
      app.db,
      settings.general.downloadPath,
      settings.general.scenesPath,
      settings.general.incompletePath
    );
    const logsService = createLogsService(app.db);

    // Scan filesystem for missing scenes
    const scanResult = await fileManager.scanFilesystem();

    app.log.info(
      `Found ${scanResult.missingScenes.length} missing scenes`
    );

    if (scanResult.missingScenes.length === 0) {
      app.log.info("No missing scenes found, filesystem sync completed");
      return;
    }

    // Process each missing scene
    for (const missing of scanResult.missingScenes) {
      try {
        // Check if scene is already in exclusions
        const excluded = await app.db.query.sceneExclusions.findFirst({
          where: eq(sceneExclusions.sceneId, missing.sceneId),
        });

        if (excluded) {
          app.log.debug(
            { sceneId: missing.sceneId },
            "Scene already excluded, skipping"
          );
          continue;
        }

        // Get setting for auto re-download
        const shouldRedownload = settings.fileManagement.autoRedownloadDeletedScenes;

        if (shouldRedownload) {
          // TODO: Re-add to download queue
          // This would require triggering a search for the scene
          app.log.info(
            { sceneId: missing.sceneId, path: missing.expectedPath },
            "Scene file missing, re-download enabled (TODO: implement search trigger)"
          );

          logsService.info({
            event: "scene_file_missing",
            message: `Scene file missing, will re-download: ${missing.sceneId}`,
            details: { sceneId: missing.sceneId, expectedPath: missing.expectedPath },
            sceneId: missing.sceneId,
          });
        } else {
          // Add to exclusions and remove scene file records
          app.log.info(
            { sceneId: missing.sceneId, path: missing.expectedPath },
            "Scene file missing, adding to exclusions"
          );

          await app.db.insert(sceneExclusions).values({
            id: crypto.randomUUID(),
            sceneId: missing.sceneId,
            reason: "user_deleted",
            excludedAt: new Date().toISOString(),
          });

          // Remove scene file records
          await app.db
            .delete(sceneFiles)
            .where(eq(sceneFiles.sceneId, missing.sceneId));

          logsService.info({
            event: "scene_excluded",
            message: `Scene excluded due to missing file: ${missing.sceneId}`,
            details: { sceneId: missing.sceneId, reason: "user_deleted" },
            sceneId: missing.sceneId,
          });
        }
      } catch (error) {
        app.log.error(
          { error, sceneId: missing.sceneId },
          "Failed to process missing scene"
        );
      }
    }

    app.log.info("Filesystem sync job completed");
  } catch (error) {
    app.log.error({ error }, "Filesystem sync job failed");
    throw error;
  }
}
