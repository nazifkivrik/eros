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
import { getJobProgressService } from "../services/job-progress.service.js";

export async function torrentMonitorJob(app: FastifyInstance) {
  const progressService = getJobProgressService();

  progressService.emitStarted("torrent-monitor", "Starting torrent monitor job");
  app.log.info("Starting torrent monitor job");

  if (!app.qbittorrent) {
    app.log.warn("qBittorrent not configured, skipping torrent monitor job");
    progressService.emitCompleted("torrent-monitor", "Skipped: qBittorrent not configured");
    return;
  }

  try {
    // Get all torrents from qBittorrent
    const torrents = await app.qbittorrent.getTorrents();

    progressService.emitProgress(
      "torrent-monitor",
      `Found ${torrents.length} torrents in qBittorrent`,
      0,
      torrents.length
    );

    app.log.info(`Found ${torrents.length} torrents in qBittorrent`);

    // Get all download queue items (include completed to check them too)
    const downloadingItems = await app.db.query.downloadQueue.findMany({
      where: inArray(downloadQueue.status, ["downloading", "queued", "completed"]),
    });

    // Map torrent hashes to download queue items (use qbitHash if available, fallback to torrentHash)
    // IMPORTANT: Normalize hashes to lowercase because qBittorrent returns lowercase hashes
    const hashToQueueItem = new Map(
      downloadingItems
        .filter((item) => item.qbitHash || item.torrentHash)
        .map((item) => {
          const hash = (item.qbitHash || item.torrentHash!).toLowerCase();
          return [hash, item];
        })
    );

    app.log.info(
      {
        totalQueueItems: downloadingItems.length,
        hashedItemsCount: hashToQueueItem.size,
        sampleHashes: Array.from(hashToQueueItem.keys()).slice(0, 3),
        sampleQueueItems: downloadingItems.slice(0, 2).map(item => ({
          id: item.id,
          title: item.title,
          status: item.status,
          qbitHash: item.qbitHash,
          torrentHash: item.torrentHash
        }))
      },
      "Hash map created for torrent monitoring"
    );

    // Initialize services for torrent completion
    const settingsService = createSettingsService(app.db);
    const settings = await settingsService.getSettings();
    const fileManager = createFileManagerService(
      app.db,
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

    let processedCount = 0;
    for (const torrent of torrents) {
      const queueItem = hashToQueueItem.get(torrent.hash);

      if (!queueItem) {
        // Torrent not in our queue, ignore
        app.log.debug(
          {
            torrentHash: torrent.hash,
            torrentName: torrent.name,
            torrentProgress: torrent.progress,
            hashedKeys: Array.from(hashToQueueItem.keys()).slice(0, 3), // Show first 3 keys for debugging
          },
          "Torrent not found in queue map"
        );
        continue;
      }

      try {
        processedCount++;
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
            { torrentHash: torrent.hash, name: torrent.name, currentStatus: queueItem.status },
            "Torrent completed, processing..."
          );

          progressService.emitProgress(
            "torrent-monitor",
            `Processing completed torrent: ${torrent.name}`,
            processedCount,
            torrents.length,
            { torrentName: torrent.name }
          );

          try {
            // Store qbitHash if not already stored
            if (!queueItem.qbitHash) {
              app.log.info({ torrentHash: torrent.hash }, "Storing qBit hash");
              await app.db
                .update(downloadQueue)
                .set({ qbitHash: torrent.hash })
                .where(eq(downloadQueue.id, queueItem.id));
            }

            // Handle torrent completion (move files, generate metadata, etc.)
            app.log.info(
              { torrentHash: torrent.hash, sceneId: queueItem.sceneId },
              "Calling handleTorrentCompleted"
            );

            await completionService.handleTorrentCompleted(torrent.hash);

            app.log.info(
              { torrentHash: torrent.hash, sceneId: queueItem.sceneId },
              "handleTorrentCompleted finished successfully"
            );
          } catch (error) {
            app.log.error(
              {
                error,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined,
                torrentHash: torrent.hash,
                sceneId: queueItem.sceneId
              },
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

    progressService.emitCompleted(
      "torrent-monitor",
      `Completed: Processed ${processedCount} torrents`,
      { processedCount, totalTorrents: torrents.length }
    );

    app.log.info("Torrent monitor job completed");
  } catch (error) {
    progressService.emitFailed(
      "torrent-monitor",
      `Torrent monitor job failed: ${error instanceof Error ? error.message : String(error)}`
    );
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
