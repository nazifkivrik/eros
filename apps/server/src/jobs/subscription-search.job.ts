/**
 * Subscription Search Job
 * Searches for new scenes for subscribed performers/studios
 * Runs every 6 hours
 */

import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  subscriptions,
  performers,
  studios,
  downloadQueue,
  scenes,
} from "@repo/database";
import { createTorrentSearchService } from "../services/torrent-search.service.js";
import { createLogsService } from "../services/logs.service.js";
import { getJobProgressService } from "../services/job-progress.service.js";
import { createQBittorrentService } from "../services/qbittorrent.service.js";
import { createSettingsService } from "../services/settings.service.js";
import { nanoid } from "nanoid";

export async function subscriptionSearchJob(app: FastifyInstance) {
  const progressService = getJobProgressService();
  app.log.info("Starting subscription search job");

  try {
    // Emit job started event
    progressService.emitStarted(
      "subscription-search",
      "Starting subscription search job"
    );

    // Get all active subscriptions
    const activeSubscriptions = await app.db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.status, "active"),
        eq(subscriptions.monitored, true)
      ),
    });

    app.log.info(
      `Found ${activeSubscriptions.length} active subscriptions to process`
    );

    progressService.emitProgress(
      "subscription-search",
      `Found ${activeSubscriptions.length} active subscriptions`,
      0,
      activeSubscriptions.length,
      { totalSubscriptions: activeSubscriptions.length }
    );

    for (let i = 0; i < activeSubscriptions.length; i++) {
      const subscription = activeSubscriptions[i];
      try {
        await processSubscription(
          app,
          subscription,
          i + 1,
          activeSubscriptions.length
        );
      } catch (error) {
        app.log.error(
          {
            error,
            subscriptionId: subscription.id,
            entityType: subscription.entityType,
          },
          "Failed to process subscription"
        );
        progressService.emitProgress(
          "subscription-search",
          `Failed to process subscription ${i + 1}/${activeSubscriptions.length}`,
          i + 1,
          activeSubscriptions.length,
          { error: error instanceof Error ? error.message : "Unknown error" }
        );
      }
    }

    app.log.info("Subscription search job completed");
    progressService.emitCompleted(
      "subscription-search",
      `Completed processing ${activeSubscriptions.length} subscriptions`,
      { totalProcessed: activeSubscriptions.length }
    );
  } catch (error) {
    app.log.error({ error }, "Subscription search job failed");
    progressService.emitFailed(
      "subscription-search",
      `Job failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { error: error instanceof Error ? error.stack : String(error) }
    );
    throw error;
  }
}

async function processSubscription(
  app: FastifyInstance,
  subscription: any,
  current: number,
  total: number
) {
  const logsService = createLogsService(app.db);
  const progressService = getJobProgressService();

  // Get entity details (performer or studio)
  let entity = null;
  let entityName = "Unknown";

  switch (subscription.entityType) {
    case "performer":
      entity = await app.db.query.performers.findFirst({
        where: eq(performers.id, subscription.entityId),
      });
      if (!entity) {
        await logsService.warning(
          "subscription",
          `Performer not found, skipping subscription`,
          {
            subscriptionId: subscription.id,
            performerId: subscription.entityId,
          }
        );
        app.log.warn(
          `[Subscription Search] Performer ${subscription.entityId} not found`
        );
        return;
      }
      entityName = entity.name;
      break;

    case "studio":
      entity = await app.db.query.studios.findFirst({
        where: eq(studios.id, subscription.entityId),
      });
      if (!entity) {
        await logsService.warning(
          "subscription",
          `Studio not found, skipping subscription`,
          { subscriptionId: subscription.id, studioId: subscription.entityId }
        );
        app.log.warn(
          `[Subscription Search] Studio ${subscription.entityId} not found`
        );
        return;
      }
      entityName = entity.name;
      break;

    case "scene":
      app.log.info(
        `[Subscription Search] Skipping scene subscription (handled differently)`
      );
      return;

    default:
      await logsService.warning(
        "subscription",
        `Unknown entity type: ${subscription.entityType}`,
        { subscriptionId: subscription.id, entityType: subscription.entityType }
      );
      app.log.warn(
        `[Subscription Search] Unknown entity type: ${subscription.entityType}`
      );
      return;
  }

  app.log.info(
    `[Subscription Search] ========================================`
  );
  app.log.info(
    `[Subscription Search] Processing: ${entityName} (${subscription.entityType})`
  );
  app.log.info(
    `[Subscription Search] ========================================`
  );

  progressService.emitProgress(
    "subscription-search",
    `Processing ${entityName} (${current}/${total})`,
    current,
    total,
    { entityType: subscription.entityType, entityName }
  );

  await logsService.info(
    "subscription",
    `Starting subscription search for ${entityName}`,
    {
      entityType: subscription.entityType,
      entityName: entityName,
      autoDownload: subscription.autoDownload,
      includeMetadataMissing: subscription.includeMetadataMissing,
      includeAliases: subscription.includeAliases,
    }
  );

  // Search for torrents using the new service with detailed logging
  try {
    const torrentSearchService = createTorrentSearchService(app.db);

    app.log.info(`[Subscription Search] Searching for ${entityName}`);

    const selectedTorrents = await torrentSearchService.searchForSubscription(
      subscription.entityType as "performer" | "studio",
      subscription.entityId,
      subscription.qualityProfileId,
      subscription.includeMetadataMissing,
      subscription.includeAliases,
      [] // No indexer filtering - use all available
    );

    app.log.info(
      `[Subscription Search] ✅ Completed for ${entityName}: ${selectedTorrents.length} torrents selected`
    );

    progressService.emitProgress(
      "subscription-search",
      `Found ${selectedTorrents.length} torrents for ${entityName}`,
      current,
      total,
      { entityName, torrentsFound: selectedTorrents.length }
    );

    await logsService.info(
      "subscription",
      `Subscription search completed for ${entityName}: ${selectedTorrents.length} torrents selected`,
      {
        entityType: subscription.entityType,
        entityName: entityName,
        selectedCount: selectedTorrents.length,
      },
      subscription.entityType === "performer"
        ? { performerId: subscription.entityId }
        : { studioId: subscription.entityId }
    );

    // Add selected torrents to download queue and qBittorrent
    if (subscription.autoDownload && selectedTorrents.length > 0) {
      // Limit torrents to prevent overwhelming the system
      const MAX_TORRENTS_PER_RUN = 50;
      const torrentsToAdd = selectedTorrents.slice(0, MAX_TORRENTS_PER_RUN);

      if (selectedTorrents.length > MAX_TORRENTS_PER_RUN) {
        app.log.info(
          `[Subscription Search] Limiting to ${MAX_TORRENTS_PER_RUN} torrents out of ${selectedTorrents.length} for ${entityName}`
        );
      }

      app.log.info(
        `[Subscription Search] Adding ${torrentsToAdd.length} torrents to download queue for ${entityName}`
      );

      // Get qBittorrent settings
      const settingsService = createSettingsService(app.db);
      const settings = await settingsService.getSettings();
      const qbittorrentConfig = settings.qbittorrent;

      app.log.info(
        `[Subscription Search] qBittorrent config: enabled=${qbittorrentConfig.enabled}, url=${qbittorrentConfig.url}`
      );

      let qbittorrentService = null;
      if (qbittorrentConfig.enabled && qbittorrentConfig.url) {
        try {
          qbittorrentService = createQBittorrentService({
            url: qbittorrentConfig.url,
            username: qbittorrentConfig.username,
            password: qbittorrentConfig.password,
          });
          app.log.info(
            `[Subscription Search] ✅ qBittorrent service initialized successfully`
          );
        } catch (error) {
          app.log.error(
            `[Subscription Search] ❌ Failed to initialize qBittorrent service: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      } else {
        app.log.warn(
          `[Subscription Search] ⚠️ qBittorrent not configured, torrents will only be added to database queue`
        );
      }

      let addedToQBittorrent = 0;
      let failedToAddToQBittorrent = 0;

      for (const torrent of torrentsToAdd) {
        app.log.info(
          `[Subscription Search] Processing torrent: "${torrent.title}" (hash: ${torrent.infoHash}, url: ${torrent.downloadUrl?.substring(0, 50)}...)`
        );

        // Check if torrent already exists in queue
        const existing = await app.db.query.downloadQueue.findFirst({
          where: eq(downloadQueue.torrentHash, torrent.infoHash),
        });

        if (existing) {
          app.log.info(
            `[Subscription Search] ⏭️  Torrent already in queue, skipping: ${torrent.title}`
          );
          continue;
        }

        // If no sceneId, create a placeholder scene for metadata-less torrents
        let sceneId = torrent.sceneId;
        if (!sceneId) {
          sceneId = nanoid();
          await app.db.insert(scenes).values({
            id: sceneId,
            slug: torrent.title.toLowerCase().replace(/\s+/g, "-"),
            title: torrent.title,
            date: null,
            duration: null,
            code: null,
            images: [],
            hasMetadata: false,
            inferredFromIndexers: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          app.log.info(
            `[Subscription Search] Created placeholder scene for metadata-less torrent: ${torrent.title}`
          );
        }

        // Create scene folder structure
        // For metadata-less scenes from torrent search, use simplified NFO (no poster)
        try {
          const { createFileManagerService } = await import("../services/file-manager.service.js");
          const fileManagerService = createFileManagerService(
            app.db,
            settings.general.scenesPath || "/media/scenes",
            settings.general.incompletePath || "/media/incomplete"
          );
          const { folderPath } = await fileManagerService.setupSceneFilesSimplified(sceneId);
          app.log.info(
            `[Subscription Search] ✅ Created scene folder with simplified metadata: ${folderPath}`
          );
        } catch (error) {
          app.log.error(
            { error, sceneId },
            `[Subscription Search] ⚠️ Failed to create scene folder (continuing): ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }

        // Add to qBittorrent if configured
        let qbittorrentStatus = "not_attempted";
        if (qbittorrentService && (torrent.downloadUrl || torrent.infoHash)) {
          try {
            const downloadPath = settings.general.incompletePath || "/media/incomplete";

            // Prefer infoHash to create magnet link (more reliable than Prowlarr's downloadUrl)
            let magnetLink: string | undefined;
            let torrentUrl: string | undefined;

            if (torrent.infoHash) {
              // Create magnet link from infoHash
              magnetLink = `magnet:?xt=urn:btih:${torrent.infoHash}&dn=${encodeURIComponent(torrent.title)}`;
              app.log.info(
                `[Subscription Search] Using magnet link from infoHash for: ${torrent.title}`
              );
            } else if (torrent.downloadUrl?.startsWith("magnet:")) {
              magnetLink = torrent.downloadUrl;
              app.log.info(
                `[Subscription Search] Using existing magnet link for: ${torrent.title}`
              );
            } else if (torrent.downloadUrl) {
              // Prowlarr's downloadUrl is a redirect/proxy - qBittorrent may not handle it
              torrentUrl = torrent.downloadUrl;
              app.log.warn(
                `[Subscription Search] No infoHash available, trying Prowlarr downloadUrl (may fail): ${torrent.title}`
              );
            }

            const success = await qbittorrentService.addTorrent({
              magnetLinks: magnetLink ? [magnetLink] : undefined,
              urls: torrentUrl ? [torrentUrl] : undefined,
              savePath: downloadPath,
              category: "eros",
              paused: false,
            });

            if (success) {
              qbittorrentStatus = "downloading";
              addedToQBittorrent++;
              app.log.info(
                `[Subscription Search] ✅ Added to qBittorrent: ${torrent.title}`
              );
            } else {
              qbittorrentStatus = "failed";
              failedToAddToQBittorrent++;
              app.log.error(
                `[Subscription Search] ❌ Failed to add to qBittorrent (returned false): ${torrent.title}`
              );
            }
          } catch (error) {
            qbittorrentStatus = "failed";
            failedToAddToQBittorrent++;
            app.log.error(
              { error, torrent: { title: torrent.title, infoHash: torrent.infoHash, downloadUrl: torrent.downloadUrl } },
              `[Subscription Search] ❌ qBittorrent error for ${torrent.title}: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        } else {
          app.log.info(
            `[Subscription Search] Skipping qBittorrent: service=${!!qbittorrentService}, downloadUrl=${!!torrent.downloadUrl}, infoHash=${!!torrent.infoHash}`
          );
        }

        // Add to download queue database
        try {
          await app.db.insert(downloadQueue).values({
            id: nanoid(),
            sceneId: sceneId,
            torrentHash: torrent.infoHash,
            title: torrent.title,
            size: torrent.size,
            seeders: torrent.seeders,
            quality: torrent.quality,
            status:
              qbittorrentStatus === "downloading" ? "downloading" : "queued",
            addedAt: new Date().toISOString(),
            completedAt: null,
          });

          app.log.info(
            `[Subscription Search] ✅ Added to database queue: ${torrent.title}`
          );
        } catch (error) {
          app.log.error(
            { error, torrentTitle: torrent.title },
            `[Subscription Search] ❌ Failed to add to database queue: ${torrent.title}`
          );
          await logsService.error(
            "subscription",
            `Failed to insert torrent to download queue: ${error instanceof Error ? error.message : "Unknown error"}`,
            {
              error: error instanceof Error ? error.stack : String(error),
              torrentTitle: torrent.title,
            }
          );
          throw error;
        }
      }

      progressService.emitProgress(
        "subscription-search",
        `Added ${torrentsToAdd.length} torrents for ${entityName} (${addedToQBittorrent} to qBittorrent)`,
        current,
        total,
        {
          entityName,
          addedToQueue: torrentsToAdd.length,
          addedToQBittorrent,
          failedToAddToQBittorrent,
        }
      );

      await logsService.info(
        "subscription",
        `Added ${torrentsToAdd.length} torrents to download queue for ${entityName}`,
        {
          entityName: entityName,
          addedCount: torrentsToAdd.length,
          totalFound: selectedTorrents.length,
        },
        subscription.entityType === "performer"
          ? { performerId: subscription.entityId }
          : { studioId: subscription.entityId }
      );
    }
  } catch (error) {
    app.log.error(
      `[Subscription Search] ❌ Failed for ${entityName}: ${error instanceof Error ? error.message : "Unknown error"}`
    );

    await logsService.error(
      "subscription",
      `Failed to process subscription for ${entityName}: ${error instanceof Error ? error.message : "Unknown error"}`,
      {
        entityName: entityName,
        entityType: subscription.entityType,
        error: error instanceof Error ? error.stack : String(error),
      },
      subscription.entityType === "performer"
        ? { performerId: subscription.entityId }
        : { studioId: subscription.entityId }
    );
    throw error;
  }
}
