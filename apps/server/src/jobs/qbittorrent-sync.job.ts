/**
 * qBittorrent Sync Job
 * Detects manually removed torrents and handles according to settings
 * Runs every 10 minutes
 */

import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { downloadQueue, sceneExclusions } from "@repo/database";

export async function qbittorrentSyncJob(app: FastifyInstance) {
  app.log.info("Starting qBittorrent sync job");

  // Get services from DI container
  const { qbittorrentService } = app.container;

  if (!qbittorrentService) {
    app.log.warn("qBittorrent not configured, skipping sync job");
    return;
  }

  try {
    const { settingsService, logsService } = app.container;
    const settings = await settingsService.getSettings();

    // Get all download queue items that are downloading or paused
    const activeDownloads = await app.db.query.downloadQueue.findMany({
      where: inArray(downloadQueue.status, ["downloading", "paused"]),
    });

    if (activeDownloads.length === 0) {
      app.log.info("No active downloads to sync");
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
      app.log.info("No manually removed torrents detected");
      return;
    }

    app.log.info(
      `Found ${removedTorrents.length} manually removed torrents`
    );

    // Process each removed torrent
    for (const removed of removedTorrents) {
      try {
        // Cancel download and add to exclusions
        app.log.info(
          { sceneId: removed.sceneId, qbitHash: removed.qbitHash },
          "Cancelling manually removed torrent"
        );

        // Update status to cancelled
        await app.db
          .update(downloadQueue)
          .set({ status: "failed", qbitHash: null })
          .where(eq(downloadQueue.id, removed.id));

        // Add to exclusions
        const existingExclusion = await app.db.query.sceneExclusions.findFirst({
          where: eq(sceneExclusions.sceneId, removed.sceneId),
        });

        if (!existingExclusion) {
          await app.db.insert(sceneExclusions).values({
            id: crypto.randomUUID(),
            sceneId: removed.sceneId,
            reason: "manual_removal",
            excludedAt: new Date().toISOString(),
          });
        }

        await logsService.info(
          "torrent",
          `Cancelled manually removed torrent for scene: ${removed.sceneId}`,
          {
            sceneId: removed.sceneId,
            qbitHash: removed.qbitHash,
            reason: "manual_removal",
          },
          { sceneId: removed.sceneId }
        );
      } catch (error) {
        app.log.error(
          { error, sceneId: removed.sceneId },
          "Failed to process removed torrent"
        );
      }
    }

    app.log.info("qBittorrent sync job completed");
  } catch (error) {
    app.log.error({ error }, "qBittorrent sync job failed");
    throw error;
  }
}
