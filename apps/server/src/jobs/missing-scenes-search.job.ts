/**
 * Missing Scenes Search Job
 * Searches for scenes that have metadata but no torrents found via performer/studio search
 * Only searches scenes with monitored subscriptions and autoDownload enabled
 * Runs after subscription-search job completes
 */

import type { FastifyInstance } from "fastify";
import { eq, and, inArray, sql, notInArray } from "drizzle-orm";
import { scenes, performersScenes, studiosScenes, subscriptions, downloadQueue, appSettings } from "@repo/database";
import { createLogsService } from "../services/logs.service.js";
import { getJobProgressService } from "../services/job-progress.service.js";
import { createQBittorrentService } from "../services/qbittorrent.service.js";
import { createSettingsService } from "../services/settings.service.js";
import { createProwlarrService } from "../services/prowlarr.service.js";
import { nanoid } from "nanoid";

export async function missingScenesSearchJob(app: FastifyInstance) {
  const progressService = getJobProgressService();
  const logsService = createLogsService(app.db);

  app.log.info("Starting missing scenes search job");

  try {
    progressService.emitStarted(
      "missing-scenes-search",
      "Finding scenes without torrents"
    );

    // Step 1: Find all scene IDs that already have torrents in download queue
    const scenesWithTorrents = await app.db
      .select({ sceneId: downloadQueue.sceneId })
      .from(downloadQueue)
      .groupBy(downloadQueue.sceneId);

    const sceneIdsWithTorrents = scenesWithTorrents.map(row => row.sceneId);

    app.log.info(`[MissingScenesSearch] Found ${sceneIdsWithTorrents.length} scenes with existing torrents`);

    // Step 2: Find monitored subscriptions with autoDownload enabled
    const monitoredSubscriptions = await app.db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.monitored, true),
        eq(subscriptions.autoDownload, true),
        eq(subscriptions.status, "active")
      ),
    });

    if (monitoredSubscriptions.length === 0) {
      app.log.info("[MissingScenesSearch] No monitored subscriptions found, skipping");
      progressService.emitCompleted(
        "missing-scenes-search",
        "No monitored subscriptions found",
        { scenesSearched: 0 }
      );
      return;
    }

    app.log.info(`[MissingScenesSearch] Found ${monitoredSubscriptions.length} monitored subscriptions`);

    // Step 3: Get all performer/studio IDs from monitored subscriptions
    const performerIds = monitoredSubscriptions
      .filter(sub => sub.entityType === "performer")
      .map(sub => sub.entityId);

    const studioIds = monitoredSubscriptions
      .filter(sub => sub.entityType === "studio")
      .map(sub => sub.entityId);

    app.log.info(`[MissingScenesSearch] Tracking ${performerIds.length} performers, ${studioIds.length} studios`);

    if (performerIds.length === 0 && studioIds.length === 0) {
      app.log.info("[MissingScenesSearch] No performers or studios to track");
      progressService.emitCompleted(
        "missing-scenes-search",
        "No performers or studios to track",
        { scenesSearched: 0 }
      );
      return;
    }

    // Step 4: Find scenes related to these performers/studios that DON'T have torrents
    let missingSceneIds: string[] = [];

    // Query scenes by performers
    if (performerIds.length > 0) {
      const performerScenes = await app.db
        .selectDistinct({ sceneId: performersScenes.sceneId })
        .from(performersScenes)
        .where(inArray(performersScenes.performerId, performerIds));

      const performerSceneIds = performerScenes.map(row => row.sceneId);
      missingSceneIds.push(...performerSceneIds);
    }

    // Query scenes by studios
    if (studioIds.length > 0) {
      const studioScenes = await app.db
        .selectDistinct({ sceneId: studiosScenes.sceneId })
        .from(studiosScenes)
        .where(inArray(studiosScenes.studioId, studioIds));

      const studioSceneIds = studioScenes.map(row => row.sceneId);
      missingSceneIds.push(...studioSceneIds);
    }

    // Remove duplicates
    missingSceneIds = [...new Set(missingSceneIds)];

    // Filter out scenes that already have torrents
    missingSceneIds = missingSceneIds.filter(id => !sceneIdsWithTorrents.includes(id));

    app.log.info(`[MissingScenesSearch] Found ${missingSceneIds.length} scenes without torrents`);

    if (missingSceneIds.length === 0) {
      progressService.emitCompleted(
        "missing-scenes-search",
        "No missing scenes found",
        { scenesSearched: 0 }
      );
      return;
    }

    progressService.emitProgress(
      "missing-scenes-search",
      `Found ${missingSceneIds.length} scenes to search`,
      0,
      missingSceneIds.length,
      { totalScenes: missingSceneIds.length }
    );

    // Step 5: Get scene details
    const missingScenes = await app.db.query.scenes.findMany({
      where: and(
        inArray(scenes.id, missingSceneIds),
        eq(scenes.hasMetadata, true) // Only search scenes with metadata
      ),
    });

    app.log.info(`[MissingScenesSearch] Searching ${missingScenes.length} scenes with metadata`);

    await logsService.info(
      "missing-scenes",
      `Starting search for ${missingScenes.length} missing scenes`,
      { sceneCount: missingScenes.length }
    );

    // Step 6: Get Prowlarr settings
    const settingsService = createSettingsService(app.db);
    const settings = await settingsService.getSettings();

    if (!settings.prowlarr.enabled || !settings.prowlarr.apiUrl) {
      app.log.error("[MissingScenesSearch] Prowlarr not configured, aborting");
      progressService.emitFailed(
        "missing-scenes-search",
        "Prowlarr not configured",
        { error: "Prowlarr API URL or key missing" }
      );
      return;
    }

    const prowlarrService = createProwlarrService({
      baseUrl: settings.prowlarr.apiUrl,
      apiKey: settings.prowlarr.apiKey,
    });

    // Step 7: Get qBittorrent service
    let qbittorrentService = null;
    if (settings.qbittorrent.enabled && settings.qbittorrent.url) {
      try {
        qbittorrentService = createQBittorrentService({
          url: settings.qbittorrent.url,
          username: settings.qbittorrent.username,
          password: settings.qbittorrent.password,
        });
        app.log.info("[MissingScenesSearch] qBittorrent service initialized");
      } catch (error) {
        app.log.error(`[MissingScenesSearch] Failed to initialize qBittorrent: ${error}`);
      }
    } else {
      app.log.warn("[MissingScenesSearch] qBittorrent not configured, torrents will only be added to queue");
    }

    // Step 8: Search each scene individually
    let torrentsFound = 0;
    let torrentsAdded = 0;

    for (let i = 0; i < missingScenes.length; i++) {
      const scene = missingScenes[i];

      try {
        app.log.info(`[MissingScenesSearch] [${i + 1}/${missingScenes.length}] Searching: ${scene.title}`);

        // Search Prowlarr for this scene
        const searchResults = await prowlarrService.searchIndexers(scene.title);

        if (searchResults.length === 0) {
          app.log.info(`[MissingScenesSearch] No results for: ${scene.title}`);
          continue;
        }

        app.log.info(`[MissingScenesSearch] Found ${searchResults.length} results for: ${scene.title}`);

        // Map results to internal format
        const mappedResults = prowlarrService.mapSearchResults(searchResults);

        // Select best torrent (highest seeders for now - can be enhanced with quality profile)
        const bestTorrent = mappedResults.reduce((best, current) => {
          return (current.seeders > best.seeders) ? current : best;
        }, mappedResults[0]);

        if (!bestTorrent) {
          continue;
        }

        torrentsFound++;

        app.log.info(`[MissingScenesSearch] Best: ${bestTorrent.title} (${bestTorrent.seeders} seeds)`);

        // Check if already in download queue
        const existing = await app.db.query.downloadQueue.findFirst({
          where: eq(downloadQueue.sceneId, scene.id),
        });

        if (existing) {
          app.log.info(`[MissingScenesSearch] Already in queue, skipping`);
          continue;
        }

        // Add to qBittorrent if configured
        let qbittorrentStatus = "queued";
        if (qbittorrentService && bestTorrent.downloadUrl) {
          try {
            const downloadPath = settings.general.downloadPath || "/downloads";
            const isMagnet = bestTorrent.downloadUrl.startsWith("magnet:");

            const success = await qbittorrentService.addTorrent({
              magnetLinks: isMagnet ? [bestTorrent.downloadUrl] : undefined,
              urls: !isMagnet ? [bestTorrent.downloadUrl] : undefined,
              savePath: downloadPath,
              category: "eros",
              paused: false,
            });

            if (success) {
              qbittorrentStatus = "downloading";
              app.log.info(`[MissingScenesSearch] Added to qBittorrent: ${scene.title}`);
            }
          } catch (error) {
            app.log.error(`[MissingScenesSearch] qBittorrent error: ${error}`);
          }
        }

        // Verify indexer exists
        const indexerExists = await app.db.query.indexers.findFirst({
          where: eq(appSettings.key, `prowlarr-${bestTorrent.indexerId}`),
        });

        const indexerId = indexerExists?.value || `prowlarr-${bestTorrent.indexerId}`;

        // Add to download queue
        await app.db.insert(downloadQueue).values({
          id: nanoid(),
          sceneId: scene.id,
          torrentHash: null, // Will be populated by torrent-monitor job
          indexerId: indexerId as string,
          title: bestTorrent.title,
          size: bestTorrent.size,
          seeders: bestTorrent.seeders,
          quality: "Unknown", // Can be enhanced with quality detection
          status: qbittorrentStatus as "queued" | "downloading",
          addedAt: new Date().toISOString(),
          completedAt: null,
        });

        torrentsAdded++;

        app.log.info(`[MissingScenesSearch] Added to queue: ${scene.title}`);

        progressService.emitProgress(
          "missing-scenes-search",
          `Processed ${i + 1}/${missingScenes.length} scenes (${torrentsAdded} added)`,
          i + 1,
          missingScenes.length,
          { torrentsFound, torrentsAdded }
        );

      } catch (error) {
        app.log.error(`[MissingScenesSearch] Error searching scene ${scene.title}: ${error}`);
      }
    }

    await logsService.info(
      "missing-scenes",
      `Completed missing scenes search: ${torrentsAdded} torrents added`,
      { scenesSearched: missingScenes.length, torrentsFound, torrentsAdded }
    );

    progressService.emitCompleted(
      "missing-scenes-search",
      `Found and added ${torrentsAdded} torrents for missing scenes`,
      { scenesSearched: missingScenes.length, torrentsFound, torrentsAdded }
    );

  } catch (error) {
    app.log.error({ error }, "Missing scenes search job failed");
    progressService.emitFailed(
      "missing-scenes-search",
      `Job failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { error: error instanceof Error ? error.stack : String(error) }
    );
    throw error;
  }
}
