/**
 * Unified Sync Job
 * Monitors both qBittorrent and filesystem for changes and handles according to settings
 * - Detects manually removed torrents from qBittorrent
 * - Detects manually deleted files from filesystem
 * - Handles based on deleteFilesOnRemove and deleteTorrentOnRemove settings
 * Runs every 10 minutes
 */

import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { downloadQueue, sceneExclusions, sceneFiles, subscriptions } from "@repo/database";
import { nanoid } from "nanoid";

export async function unifiedSyncJob(app: FastifyInstance) {
  app.log.info("Starting unified sync job");

  try {
    // Get services from DI container
    const { settingsService, logsService } = app.container;
    const settings = await settingsService.getSettings();

    // Run both qBittorrent and filesystem checks
    await checkQBittorrentSync(app, settings, logsService);
    await checkFilesystemSync(app, settings, logsService);

    app.log.info("Unified sync job completed");
  } catch (error) {
    app.log.error({ error }, "Unified sync job failed");
    throw error;
  }
}

/**
 * Check qBittorrent for manually removed torrents
 */
async function checkQBittorrentSync(
  app: FastifyInstance,
  settings: any,
  logsService: any
) {
  const { qbittorrentService } = app.container;

  if (!qbittorrentService) {
    app.log.warn("qBittorrent not configured, skipping qBittorrent sync");
    return;
  }

  // Get all download queue items that are downloading or paused
  const activeDownloads = await app.db.query.downloadQueue.findMany({
    where: inArray(downloadQueue.status, ["downloading", "paused"]),
  });

  if (activeDownloads.length === 0) {
    app.log.debug("No active downloads to sync with qBittorrent");
    return;
  }

  // Get all torrents from qBittorrent
  const torrents = await qbittorrentService.getTorrents();
  const qbitHashes = new Set(torrents.map((t) => t.hash));

  app.log.info(
    `Syncing ${activeDownloads.length} active downloads with ${torrents.length} qBittorrent torrents`
  );

  // Find downloads that are in DB but not in qBittorrent (manually removed)
  const removedTorrents = activeDownloads.filter(
    (download) => download.qbitHash && !qbitHashes.has(download.qbitHash)
  );

  if (removedTorrents.length === 0) {
    app.log.debug("No manually removed torrents detected");
    return;
  }

  app.log.info(
    `Found ${removedTorrents.length} manually removed torrents from qBittorrent`
  );

  // Process each removed torrent
  for (const removed of removedTorrents) {
    try {
      const shouldReAdd = settings.fileManagement.deleteTorrentOnRemove;

      if (shouldReAdd && removed.torrentHash) {
        // Re-add torrent to qBittorrent
        app.log.info(
          { sceneId: removed.sceneId, qbitHash: removed.qbitHash },
          "Re-adding manually removed torrent to qBittorrent"
        );

        try {
          await qbittorrentService.addTorrent({
            magnetLinks: [`magnet:?xt=urn:btih:${removed.torrentHash}`],
            category: "eros",
            paused: false,
          });

          logsService.info({
            event: "torrent_readded",
            message: `Re-added manually removed torrent for scene: ${removed.sceneId}`,
            details: {
              sceneId: removed.sceneId,
              qbitHash: removed.qbitHash,
              torrentHash: removed.torrentHash,
            },
            sceneId: removed.sceneId,
          });
        } catch (error) {
          app.log.error(
            { error, sceneId: removed.sceneId },
            "Failed to re-add torrent to qBittorrent"
          );
        }
      } else {
        // Unsubscribe scene by setting subscription to inactive
        app.log.info(
          { sceneId: removed.sceneId, qbitHash: removed.qbitHash },
          "Marking subscription as inactive (torrent manually removed)"
        );

        // Update status to failed
        await app.db
          .update(downloadQueue)
          .set({ status: "failed", qbitHash: null })
          .where(eq(downloadQueue.id, removed.id));

        // Find and update subscription status to inactive
        const subscription = await app.db.query.subscriptions.findFirst({
          where: eq(subscriptions.entityId, removed.sceneId),
        });

        if (subscription) {
          await app.db
            .update(subscriptions)
            .set({
              status: "inactive",
              updatedAt: new Date().toISOString()
            })
            .where(eq(subscriptions.id, subscription.id));
        }

        // Add to exclusions
        const existingExclusion = await app.db.query.sceneExclusions.findFirst({
          where: eq(sceneExclusions.sceneId, removed.sceneId),
        });

        if (!existingExclusion) {
          await app.db.insert(sceneExclusions).values({
            id: nanoid(),
            sceneId: removed.sceneId,
            reason: "manual_removal",
            excludedAt: new Date().toISOString(),
          });
        }

        logsService.info({
          event: "subscription_inactive",
          message: `Marked subscription as inactive (torrent manually removed): ${removed.sceneId}`,
          details: {
            sceneId: removed.sceneId,
            qbitHash: removed.qbitHash,
            reason: "manual_removal",
          },
          sceneId: removed.sceneId,
        });
      }
    } catch (error) {
      app.log.error(
        { error, sceneId: removed.sceneId },
        "Failed to process removed torrent"
      );
    }
  }
}

/**
 * Check filesystem for manually deleted files
 */
async function checkFilesystemSync(
  app: FastifyInstance,
  settings: any,
  logsService: any
) {
  // Get FileManagerService from container
  const { fileManagerService } = app.container;

  // Scan filesystem for missing scenes
  const scanResult = await fileManagerService.scanFilesystem();

  app.log.info(
    `Found ${scanResult.missingScenes.length} missing scenes in filesystem`
  );

  if (scanResult.missingScenes.length === 0) {
    app.log.debug("No missing scenes found in filesystem");
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

      const shouldRedownload = settings.fileManagement.deleteFilesOnRemove;

      if (shouldRedownload) {
        // Mark for re-download by keeping subscription active
        app.log.info(
          { sceneId: missing.sceneId, path: missing.expectedPath },
          "Scene file missing, will re-download on next search"
        );

        // Remove scene file records to trigger re-download
        await app.db
          .delete(sceneFiles)
          .where(eq(sceneFiles.sceneId, missing.sceneId));

        logsService.info({
          event: "scene_file_missing_redownload",
          message: `Scene file missing, marked for re-download: ${missing.sceneId}`,
          details: { sceneId: missing.sceneId, expectedPath: missing.expectedPath },
          sceneId: missing.sceneId,
        });
      } else {
        // Mark subscription as inactive (don't re-download)
        app.log.info(
          { sceneId: missing.sceneId, path: missing.expectedPath },
          "Scene file missing, marking subscription as inactive"
        );

        // Find and update subscription status to inactive
        const subscription = await app.db.query.subscriptions.findFirst({
          where: eq(subscriptions.entityId, missing.sceneId),
        });

        if (subscription) {
          await app.db
            .update(subscriptions)
            .set({
              status: "inactive",
              updatedAt: new Date().toISOString()
            })
            .where(eq(subscriptions.id, subscription.id));
        }

        // Add to exclusions
        await app.db.insert(sceneExclusions).values({
          id: nanoid(),
          sceneId: missing.sceneId,
          reason: "user_deleted",
          excludedAt: new Date().toISOString(),
        });

        // Remove scene file records
        await app.db
          .delete(sceneFiles)
          .where(eq(sceneFiles.sceneId, missing.sceneId));

        logsService.info({
          event: "subscription_inactive",
          message: `Marked subscription as inactive (files deleted): ${missing.sceneId}`,
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
}
