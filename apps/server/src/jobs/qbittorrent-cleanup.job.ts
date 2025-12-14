/**
 * qBittorrent Cleanup Job
 * Removes completed torrents from qBittorrent after X days
 * Runs daily at 4 AM
 */

import type { FastifyInstance } from "fastify";
import { eq, and, lt } from "drizzle-orm";
import { downloadQueue } from "@repo/database";
import { createLogsService } from "../services/logs.service.js";
import { createSettingsService } from "../services/settings.service.js";

export async function qbittorrentCleanupJob(app: FastifyInstance) {
  app.log.info("Starting qBittorrent cleanup job");

  if (!app.qbittorrent) {
    app.log.warn("qBittorrent not configured, skipping cleanup job");
    return;
  }

  try {
    const settingsService = createSettingsService(app.db);
    const settings = await settingsService.getSettings();
    const logsService = createLogsService(app.db);

    const daysToKeep = settings.fileManagement.removeFromQbitAfterDays;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateISO = cutoffDate.toISOString();

    app.log.info(
      `Cleaning up torrents completed before ${cutoffDateISO} (${daysToKeep} days ago)`
    );

    // Find completed downloads older than X days that still have qbitHash
    const oldCompletedDownloads = await app.db.query.downloadQueue.findMany({
      where: and(
        eq(downloadQueue.status, "completed"),
        lt(downloadQueue.completedAt, cutoffDateISO)
      ),
    });

    // Filter only those with qbitHash (not already removed)
    const torrentsToRemove = oldCompletedDownloads.filter(
      (download) => download.qbitHash
    );

    if (torrentsToRemove.length === 0) {
      app.log.info("No old torrents to clean up");
      return;
    }

    app.log.info(
      `Found ${torrentsToRemove.length} old completed torrents to remove from qBittorrent`
    );

    // Remove each torrent from qBittorrent
    let removedCount = 0;
    let failedCount = 0;

    for (const torrent of torrentsToRemove) {
      try {
        // Remove from qBittorrent (keep files on disk)
        await app.qbittorrent.removeTorrent(torrent.qbitHash!, false);

        // Clear qbitHash from database
        await app.db
          .update(downloadQueue)
          .set({ qbitHash: null })
          .where(eq(downloadQueue.id, torrent.id));

        removedCount++;

        app.log.info(
          { sceneId: torrent.sceneId, qbitHash: torrent.qbitHash },
          "Removed old torrent from qBittorrent"
        );

        await logsService.info(
          "torrent",
          `Removed old completed torrent from qBittorrent: ${torrent.sceneId}`,
          {
            sceneId: torrent.sceneId,
            qbitHash: torrent.qbitHash,
            completedAt: torrent.completedAt,
            daysOld: Math.floor(
              (Date.now() - new Date(torrent.completedAt!).getTime()) /
                (1000 * 60 * 60 * 24)
            ),
          },
          { sceneId: torrent.sceneId }
        );
      } catch (error) {
        failedCount++;
        app.log.error(
          { error, sceneId: torrent.sceneId, qbitHash: torrent.qbitHash },
          "Failed to remove torrent from qBittorrent"
        );
      }
    }

    app.log.info(
      `qBittorrent cleanup completed: ${removedCount} removed, ${failedCount} failed`
    );
  } catch (error) {
    app.log.error({ error }, "qBittorrent cleanup job failed");
    throw error;
  }
}
