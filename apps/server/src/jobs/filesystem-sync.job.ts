/**
 * Filesystem Sync Job
 * Scans filesystem for missing scenes and handles according to settings
 * Runs every 30 minutes
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { sceneFiles, sceneExclusions, downloadQueue, scenes } from "@repo/database";
import { nanoid } from "nanoid";

export async function filesystemSyncJob(app: FastifyInstance) {
  app.log.info("Starting filesystem sync job");

  try {
    // Get services from DI container
    const { settingsService, fileManagerService, logsService } = app.container;

    const settings = await settingsService.getSettings();

    // Scan filesystem for missing scenes
    const scanResult = await fileManagerService.scanFilesystem();

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

        await logsService.info(
          "system",
          `Scene excluded due to missing file: ${missing.sceneId}`,
          { sceneId: missing.sceneId, reason: "user_deleted" },
          { sceneId: missing.sceneId }
        );
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
