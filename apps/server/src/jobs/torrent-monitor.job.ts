/**
 * Torrent Monitor Job
 * Monitors qBittorrent status and manages stalled torrents
 * Runs every 5 minutes
 */

import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { downloadQueue } from "@repo/database";
import { getSpeedProfileService } from "../services/speed-profile.service.js";
import { createTorrentCompletionService } from "../services/torrent-completion.service.js";
import { createFileManagerService } from "../services/file-manager.service.js";
import { createLogsService } from "../services/logs.service.js";
import { createSettingsService } from "../services/settings.service.js";

export async function torrentMonitorJob(app: FastifyInstance) {
  app.log.info("Starting torrent monitor job");

  if (!app.qbittorrent) {
    app.log.warn("qBittorrent not configured, skipping torrent monitor job");
    return;
  }

  try {
    // Get all torrents from qBittorrent
    const torrents = await app.qbittorrent.getTorrents();

    app.log.info(`Found ${torrents.length} torrents in qBittorrent`);

    // Get all download queue items that are downloading
    const downloadingItems = await app.db.query.downloadQueue.findMany({
      where: inArray(downloadQueue.status, ["downloading", "queued"]),
    });

    // Map torrent hashes to download queue items (use qbitHash if available, fallback to torrentHash)
    const hashToQueueItem = new Map(
      downloadingItems
        .filter((item) => item.qbitHash || item.torrentHash)
        .map((item) => [item.qbitHash || item.torrentHash!, item])
    );

    // Initialize services for torrent completion
    const settingsService = createSettingsService(app.db);
    const settings = await settingsService.getSettings();
    const fileManager = createFileManagerService(
      app.db,
      settings.general.downloadPath,
      settings.general.scenesPath,
      settings.general.incompletePath
    );
    const logsService = createLogsService(app.db);
    const completionService = createTorrentCompletionService(
      app.db,
      fileManager,
      app.qbittorrent,
      logsService
    );

    for (const torrent of torrents) {
      const queueItem = hashToQueueItem.get(torrent.hash);

      if (!queueItem) {
        // Torrent not in our queue, ignore
        continue;
      }

      try {
        // Check if torrent is stalled (no progress, low speed, low seeds)
        const isStalled = checkIfStalled(torrent);

        if (isStalled) {
          app.log.warn(
            {
              torrentHash: torrent.hash,
              name: torrent.name,
              seeders: torrent.num_seeds,
              downloadSpeed: torrent.dlspeed,
            },
            "Torrent is stalled, pausing and moving to bottom of queue"
          );

          // Move to bottom of queue
          await app.qbittorrent.setTorrentPriority(torrent.hash, "bottom");

          // Pause stalled torrent
          await app.qbittorrent.pauseTorrent(torrent.hash);

          // Update status in database
          await app.db
            .update(downloadQueue)
            .set({ status: "paused" })
            .where(eq(downloadQueue.id, queueItem.id));
        } else if (torrent.state === "pausedDL") {
          // Torrent is paused in qBittorrent but not in our DB
          if (queueItem.status === "downloading") {
            await app.db
              .update(downloadQueue)
              .set({ status: "paused" })
              .where(eq(downloadQueue.id, queueItem.id));
          }
        } else if (torrent.progress >= 1.0 && queueItem.status !== "completed") {
          // Torrent completed - trigger completion handler
          app.log.info(
            { torrentHash: torrent.hash, name: torrent.name },
            "Torrent completed, processing..."
          );

          try {
            // Store qbitHash if not already stored
            if (!queueItem.qbitHash) {
              await app.db
                .update(downloadQueue)
                .set({ qbitHash: torrent.hash })
                .where(eq(downloadQueue.id, queueItem.id));
            }

            // Handle torrent completion (move files, generate metadata, etc.)
            await completionService.handleTorrentCompleted(torrent.hash);
          } catch (error) {
            app.log.error(
              { error, torrentHash: torrent.hash, sceneId: queueItem.sceneId },
              "Failed to process completed torrent"
            );

            // Mark as failed in database
            await app.db
              .update(downloadQueue)
              .set({ status: "failed" })
              .where(eq(downloadQueue.id, queueItem.id));
          }
        } else if (
          queueItem.status === "queued" &&
          torrent.state !== "pausedDL"
        ) {
          // Torrent is actively downloading, update status
          await app.db
            .update(downloadQueue)
            .set({ status: "downloading" })
            .where(eq(downloadQueue.id, queueItem.id));
        }
      } catch (error) {
        app.log.error(
          { error, torrentHash: torrent.hash },
          "Failed to monitor torrent"
        );
      }
    }

    // Apply speed profiles if enabled
    await applySpeedProfiles(app);

    app.log.info("Torrent monitor job completed");
  } catch (error) {
    app.log.error({ error }, "Torrent monitor job failed");
    throw error;
  }
}

/**
 * Apply speed profile limits to all torrents
 */
async function applySpeedProfiles(app: FastifyInstance) {
  const speedProfileService = getSpeedProfileService();

  if (!speedProfileService) {
    return;
  }

  const settings = speedProfileService.getSettings();

  if (!settings.enabled) {
    return;
  }

  const limits = speedProfileService.getActiveSpeedLimits();

  app.log.info(
    {
      limits: speedProfileService.formatSpeedLimits(limits),
    },
    "Applying speed profile"
  );

  try {
    // Apply global speed limits to qBittorrent
    if (app.qbittorrent) {
      await app.qbittorrent.setGlobalSpeedLimits(
        limits.downloadLimit,
        limits.uploadLimit
      );
    }
  } catch (error) {
    app.log.error({ error }, "Failed to apply speed profile");
  }
}

/**
 * Check if a torrent is stalled
 */
function checkIfStalled(torrent: any): boolean {
  // Consider stalled if:
  // 1. No seeders available
  if (torrent.num_seeds === 0) {
    return true;
  }

  // 2. Download speed is 0 for active torrents
  if (
    torrent.state === "downloading" &&
    torrent.dlspeed === 0 &&
    torrent.progress < 1.0
  ) {
    return true;
  }

  // 3. Very low seeders (< 2) and very low speed (< 10 KB/s)
  if (torrent.num_seeds < 2 && torrent.dlspeed < 10240) {
    return true;
  }

  return false;
}
