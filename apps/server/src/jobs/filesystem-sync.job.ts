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

        // Get setting for auto re-download
        const shouldRedownload = settings.fileManagement.autoRedownloadDeletedScenes;

        if (shouldRedownload) {
          // Check if already in download queue
          const existingInQueue = await app.db.query.downloadQueue.findFirst({
            where: eq(downloadQueue.sceneId, missing.sceneId),
          });

          if (existingInQueue) {
            app.log.debug(
              { sceneId: missing.sceneId },
              "Scene already in download queue, skipping"
            );
            continue;
          }

          // Get scene details for search
          const scene = await app.db.query.scenes.findFirst({
            where: eq(scenes.id, missing.sceneId),
          });

          if (!scene) {
            app.log.warn(
              { sceneId: missing.sceneId },
              "Scene not found in database, cannot re-download"
            );
            continue;
          }

          app.log.info(
            { sceneId: missing.sceneId, title: scene.title },
            "Scene file missing, searching for torrents to re-download"
          );

          // Search for torrents if Prowlarr is configured
          if (settings.prowlarr.enabled && settings.prowlarr.apiUrl && app.container.prowlarrService) {
            try {
              const searchResults = await app.container.prowlarrService.searchIndexers(scene.title);

              if (searchResults.length > 0) {
                const mappedResults = app.container.prowlarrService.mapSearchResults(searchResults);

                // Select best torrent (highest seeders)
                const bestTorrent = mappedResults.reduce((best, current) => {
                  return (current.seeders > best.seeders) ? current : best;
                }, mappedResults[0]);

                app.log.info(
                  { sceneId: missing.sceneId, torrentTitle: bestTorrent.title },
                  `Found torrent with ${bestTorrent.seeders} seeders`
                );

                // Add to qBittorrent if configured
                let qbittorrentStatus = "queued";
                if (settings.qbittorrent.enabled && settings.qbittorrent.url && bestTorrent.downloadUrl && app.container.qbittorrentService) {
                  try {
                    const downloadPath = settings.general.incompletePath || "/media/incomplete";
                    const isMagnet = bestTorrent.downloadUrl.startsWith("magnet:");

                    const success = await app.container.qbittorrentService.addTorrent({
                      magnetLinks: isMagnet ? [bestTorrent.downloadUrl] : undefined,
                      urls: !isMagnet ? [bestTorrent.downloadUrl] : undefined,
                      savePath: downloadPath,
                      category: "eros",
                      paused: false,
                    });

                    if (success) {
                      qbittorrentStatus = "downloading";
                      app.log.info(
                        { sceneId: missing.sceneId },
                        "Added to qBittorrent for re-download"
                      );
                    }
                  } catch (qbError) {
                    app.log.error(
                      { error: qbError, sceneId: missing.sceneId },
                      "Failed to add to qBittorrent"
                    );
                  }
                }

                // Add to download queue
                await app.db.insert(downloadQueue).values({
                  id: nanoid(),
                  sceneId: missing.sceneId,
                  torrentHash: null,
                  title: bestTorrent.title,
                  size: bestTorrent.size,
                  seeders: bestTorrent.seeders,
                  quality: "Unknown",
                  status: qbittorrentStatus as "queued" | "downloading",
                  addedAt: new Date().toISOString(),
                  completedAt: null,
                });

                await logsService.info(
                  "download",
                  `Scene file missing, re-download queued: ${scene.title}`,
                  { sceneId: missing.sceneId, torrentTitle: bestTorrent.title },
                  { sceneId: missing.sceneId }
                );
              } else {
                app.log.warn(
                  { sceneId: missing.sceneId, title: scene.title },
                  "No torrents found for missing scene"
                );

                await logsService.warning(
                  "download",
                  `No torrents found for missing scene: ${scene.title}`,
                  { sceneId: missing.sceneId },
                  { sceneId: missing.sceneId }
                );
              }
            } catch (searchError) {
              app.log.error(
                { error: searchError, sceneId: missing.sceneId },
                "Failed to search for torrents"
              );

              await logsService.error(
                "download",
                `Failed to search for missing scene: ${searchError instanceof Error ? searchError.message : "Unknown error"}`,
                { sceneId: missing.sceneId },
                { sceneId: missing.sceneId }
              );
            }
          } else {
            app.log.warn(
              { sceneId: missing.sceneId },
              "Prowlarr not configured, cannot search for torrents"
            );

            await logsService.warning(
              "download",
              "Scene file missing but Prowlarr not configured for re-download",
              { sceneId: missing.sceneId },
              { sceneId: missing.sceneId }
            );
          }
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

          await logsService.info(
            "system",
            `Scene excluded due to missing file: ${missing.sceneId}`,
            { sceneId: missing.sceneId, reason: "user_deleted" },
            { sceneId: missing.sceneId }
          );
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
