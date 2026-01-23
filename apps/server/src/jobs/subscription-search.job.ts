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
  performersScenes,
  qualityProfiles,
} from "@repo/database";
import { nanoid } from "nanoid";
import { createTorrentParserService } from "../application/services/torrent-quality/parser.service.js";

export async function subscriptionSearchJob(app: FastifyInstance) {
  // Get services from DI container
  const { jobProgressService } = app.container;
  const progressService = jobProgressService;
  app.log.info("Starting subscription search job");

  try {
    // Emit job started event
    progressService.emitStarted(
      "subscription-search",
      "Starting subscription search job"
    );

    // Get all active subscriptions
    const activeSubscriptions = await app.db.query.subscriptions.findMany({
      where: eq(subscriptions.isSubscribed, true),
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

    // Separate subscriptions by type
    const performerSubscriptions = activeSubscriptions.filter(s => s.entityType === "performer");
    const studioSubscriptions = activeSubscriptions.filter(s => s.entityType === "studio");
    const sceneSubscriptions = activeSubscriptions.filter(s => s.entityType === "scene");

    app.log.info(
      `Processing ${performerSubscriptions.length} performers, ${studioSubscriptions.length} studios, ${sceneSubscriptions.length} scene subscriptions`
    );

    // Step 1: Process performer subscriptions (individual search)
    const foundSceneIds = new Set<string>();

    for (let i = 0; i < performerSubscriptions.length; i++) {
      const subscription = performerSubscriptions[i];
      try {
        const foundIds = await processPerformerSubscription(
          app,
          subscription,
          i + 1,
          performerSubscriptions.length
        );
        foundIds.forEach(id => foundSceneIds.add(id));
      } catch (error) {
        app.log.error(
          {
            error,
            subscriptionId: subscription.id,
          },
          "Failed to process performer subscription"
        );
      }
    }

    // Step 2: Process studio subscriptions (individual search)
    for (let i = 0; i < studioSubscriptions.length; i++) {
      const subscription = studioSubscriptions[i];
      try {
        const foundIds = await processStudioSubscription(
          app,
          subscription,
          i + 1,
          studioSubscriptions.length
        );
        foundIds.forEach(id => foundSceneIds.add(id));
      } catch (error) {
        app.log.error(
          {
            error,
            subscriptionId: subscription.id,
          },
          "Failed to process studio subscription"
        );
      }
    }

    app.log.info(
      `[Subscription Search] Found torrents for ${foundSceneIds.size} scenes from performer/studio subscriptions`
    );

    // Step 3: Collect remaining scenes for bulk search
    const bulkScenes = await collectRemainingScenesForBulkSearch(
      app,
      performerSubscriptions,
      studioSubscriptions,
      sceneSubscriptions,
      foundSceneIds
    );

    app.log.info(
      `[Subscription Search] Bulk searching ${bulkScenes.length} remaining scenes`
    );

    // Step 4: Process remaining scenes with bulk search
    if (bulkScenes.length > 0) {
      await processBulkSceneSearch(app, bulkScenes, progressService);
    } else {
      app.log.info("[Subscription Search] No remaining scenes for bulk search");
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
  // Get services from DI container
  const { logsService, jobProgressService } = app.container;
  const progressService = jobProgressService;

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
      entity = await app.db.query.scenes.findFirst({
        where: eq(scenes.id, subscription.entityId),
      });
      if (!entity) {
        await logsService.warning(
          "subscription",
          `Scene not found, skipping subscription`,
          {
            subscriptionId: subscription.id,
            sceneId: subscription.entityId,
          }
        );
        app.log.warn(
          `[Subscription Search] Scene ${subscription.entityId} not found`
        );
        return;
      }
      entityName = entity.title;
      break;

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
    const { torrentSearchService } = app.container;

    app.log.info(`[Subscription Search] Searching for ${entityName}`);

    const selectedTorrents = await torrentSearchService.searchForSubscription(
      subscription.entityType as "performer" | "studio" | "scene",
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
      const { settingsService, torrentClient } = app.container;
      const settings = await settingsService.getSettings();
      const qbittorrentConfig = settings.qbittorrent;

      app.log.info(
        `[Subscription Search] qBittorrent config: enabled=${qbittorrentConfig.enabled}, url=${qbittorrentConfig.url}`
      );

      if (!torrentClient || !qbittorrentConfig.enabled || !qbittorrentConfig.url) {
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

        // If no sceneId, find existing placeholder or create a new one
        let sceneId = torrent.sceneId;
        if (!sceneId) {
          // Clean the torrent title for better folder naming and display
          const { createTorrentParserService } = await import("../services/torrent-parser.service.js");
          const parserService = createTorrentParserService();
          const cleanedTitle = parserService.parseTorrent(torrent.title).title;

          // Check if a placeholder scene with this cleaned title already exists
          const existingScene = await app.db.query.scenes.findFirst({
            where: and(
              eq(scenes.title, cleanedTitle),
              eq(scenes.hasMetadata, false)
            ),
          });

          if (existingScene) {
            sceneId = existingScene.id;
            app.log.info(
              `[Subscription Search] Using existing placeholder scene: ${cleanedTitle}`
            );
          } else {
            sceneId = nanoid();
            await app.db.insert(scenes).values({
              id: sceneId,
              slug: cleanedTitle.toLowerCase().replace(/\s+/g, "-"),
              title: cleanedTitle,
              contentType: "scene", // Required field
              date: null,
              duration: null,
              code: null,
              images: [],
              siteId: null, // Nullable foreign key
              hasMetadata: false,
              inferredFromIndexers: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            app.log.info(
              `[Subscription Search] Created placeholder scene for metadata-less torrent: ${cleanedTitle} (original: ${torrent.title})`
            );

            // Create scene-level subscription for the new metadata-less scene
            // This ensures it shows up in subscriptions and isSubscribed is true
            await app.db.insert(subscriptions).values({
              id: nanoid(),
              entityType: "scene",
              entityId: sceneId,
              qualityProfileId: subscription.qualityProfileId,
              autoDownload: subscription.autoDownload,
              includeMetadataMissing: false, // Scene doesn't need metadata-less search
              includeAliases: false, // Scene doesn't need alias search
              isSubscribed: true, // Explicitly set to true
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            app.log.info(
              `[Subscription Search] ✅ Created scene subscription for metadata-less scene: ${cleanedTitle}`
            );
          }
        }

        // Create scene folder structure
        // For metadata-less scenes from torrent search, use simplified NFO (no poster)
        try {
          const { fileManagerService } = app.container;
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
        let dbStatus: "queued" | "downloading" | "add_failed" = "queued";
        let addToClientAttempts = 0;
        let addToClientLastAttempt: string | null = null;
        let addToClientError: string | null = null;
        let qbitHash: string | null = null;

        if (torrentClient && (torrent.downloadUrl || torrent.infoHash)) {
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

          // Use addTorrentAndGetHash to get the qBittorrent hash immediately
          try {
            qbitHash = await torrentClient.addTorrentAndGetHash(
              {
                magnetLinks: magnetLink ? [magnetLink] : undefined,
                urls: torrentUrl ? [torrentUrl] : undefined,
                savePath: downloadPath,
                category: "eros",
                paused: false,
                matchInfoHash: torrent.infoHash,
                matchTitle: torrent.title,
              },
              10000 // 10 second timeout
            );

            if (qbitHash) {
              // Only mark as downloading after qBittorrent confirms
              dbStatus = "downloading";
              addedToQBittorrent++;
              app.log.info(
                `[Subscription Search] ✅ Added to qBittorrent: ${torrent.title} (qbitHash: ${qbitHash})`
              );
            } else {
              // Mark as add_failed instead of generic "failed" - enables retry logic
              dbStatus = "add_failed";
              addToClientAttempts = 1;
              addToClientLastAttempt = new Date().toISOString();
              addToClientError = "qBittorrent.addTorrentAndGetHash returned null";
              failedToAddToQBittorrent++;
              app.log.error(
                `[Subscription Search] ❌ Failed to add to qBittorrent (hash not found): ${torrent.title}`
              );
            }
          } catch (error) {
            // Mark as add_failed instead of generic "failed" - enables retry logic
            dbStatus = "add_failed";
            addToClientAttempts = 1;
            addToClientLastAttempt = new Date().toISOString();
            addToClientError = error instanceof Error ? error.message : String(error);
            failedToAddToQBittorrent++;
            app.log.error(
              { error, torrent: { title: torrent.title, infoHash: torrent.infoHash, downloadUrl: torrent.downloadUrl } },
              `[Subscription Search] ❌ qBittorrent error for ${torrent.title}: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        } else {
          app.log.info(
            `[Subscription Search] Skipping qBittorrent: service=${!!torrentClient}, downloadUrl=${!!torrent.downloadUrl}, infoHash=${!!torrent.infoHash}`
          );
        }

        // Add to download queue database
        try {
          await app.db.insert(downloadQueue).values({
            id: nanoid(),
            sceneId: sceneId,
            torrentHash: torrent.infoHash,
            qbitHash, // Save qBittorrent hash if available
            title: torrent.title,
            size: torrent.size,
            seeders: torrent.seeders,
            quality: torrent.quality,
            status: dbStatus,
            addToClientAttempts,
            addToClientLastAttempt,
            addToClientError,
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

/**
 * Process scene subscriptions with bulk search
 * Searches for all scene titles in a single Prowlarr request
 * Expects sceneSubscriptions to be an array of { subscription, scene } objects
 */
async function processBulkSceneSearch(
  app: FastifyInstance,
  sceneSubscriptions: Array<{ subscription: any; scene: any }>,
  progressService: any
) {
  const { logsService } = app.container;

  app.log.info(
    `[Subscription Search] Starting bulk scene search for ${sceneSubscriptions.length} scenes`
  );

  // Debug: Log the first subscription object structure
  if (sceneSubscriptions.length > 0) {
    const firstSub = sceneSubscriptions[0];
    app.log.info(
      `[Subscription Search] DEBUG First subscription: ${JSON.stringify(firstSub)}`
    );
  }

  progressService.emitProgress(
    "subscription-search",
    `Bulk searching ${sceneSubscriptions.length} scene subscriptions`,
    sceneSubscriptions.length,
    sceneSubscriptions.length,
    { sceneCount: sceneSubscriptions.length }
  );

  try {
    // sceneSubscriptions is already { subscription, scene } objects from collectRemainingScenesForBulkSearch
    // Filter out scenes not found
    const validScenes = sceneSubscriptions.filter((sd) => sd.scene !== null);

    // Log any scenes that weren't found
    const notFoundCount = sceneSubscriptions.filter((sd) => sd.scene === null).length;
    if (notFoundCount > 0) {
      app.log.warn(
        `[Subscription Search] ${notFoundCount} scene subscriptions couldn't find their scenes in database`
      );
    }

    app.log.info(
      `[Subscription Search] Bulk searching ${validScenes.length} valid scenes (out of ${sceneSubscriptions.length} total)`
    );

    // Collect all search terms (scene titles)
    const searchTerms = validScenes
      .map((sd) => sd.scene?.title)
      .filter((title): title is string => title !== undefined && title !== null);

    app.log.info(
      `[Subscription Search] Bulk searching for ${searchTerms.length} titles in Prowlarr`
    );

    if (searchTerms.length === 0) {
      app.log.warn("[Subscription Search] No valid search terms found");
      return;
    }

    // Get Prowlarr settings
    const { settingsService } = app.container;
    const settings = await settingsService.getSettings();
    const prowlarrConfig = settings.prowlarr;

    // Remove trailing slash from apiUrl if present
    const prowlarrUrl = prowlarrConfig.apiUrl.replace(/\/$/, '');

    if (!prowlarrConfig.enabled || !prowlarrConfig.apiUrl || !prowlarrConfig.apiKey) {
      app.log.warn("[Subscription Search] Prowlarr not configured, skipping bulk scene search");
      return;
    }

    // Use Prowlarr search
    // NOTE: Prowlarr bulk search API format is complex, using individual searches for now
    // TODO: Investigate correct bulk search format for Prowlarr API
    const allTorrents: any[] = [];
    app.log.info(`[Subscription Search] Using individual searches for ${searchTerms.length} terms`);

    for (const term of searchTerms) {
      try {
        const response = await fetch(
          `${prowlarrUrl}/api/v1/search?query=${encodeURIComponent(term)}&type=search&limit=100`,
          {
            headers: {
              "X-Api-Key": prowlarrConfig.apiKey,
            },
          }
        );

        if (!response.ok) {
          app.log.warn(`[Subscription Search] Prowlarr search failed for "${term}"`);
          continue;
        }

        const prowlarrResults = await response.json();
        allTorrents.push(...prowlarrResults);

        app.log.info(
          `[Subscription Search] Prowlarr returned ${prowlarrResults.length} results for "${term}"`
        );
      } catch (error) {
        app.log.error(
          `[Subscription Search] Failed to search Prowlarr for "${term}": ${error}`
        );
      }
    }

    app.log.info(
      `[Subscription Search] Search complete: ${allTorrents.length} total torrents found`
    );

    // Match torrents to scene subscriptions
    await processBulkSceneResults(
      app,
      validScenes,
      allTorrents,
      logsService,
      progressService
    );

    progressService.emitProgress(
      "subscription-search",
      `Bulk scene search complete for ${validScenes.length} scenes`,
      sceneSubscriptions.length,
      sceneSubscriptions.length,
      { sceneCount: validScenes.length }
    );

    await logsService.info(
      "subscription",
      `Bulk scene search completed for ${validScenes.length} scene subscriptions`,
      {
        sceneCount: validScenes.length,
        torrentsFound: allTorrents.length,
      }
    );
  } catch (error) {
    app.log.error(
      `[Subscription Search] Bulk scene search failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    await logsService.error(
      "subscription",
      `Bulk scene search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { error: error instanceof Error ? error.stack : String(error) }
    );
    throw error;
  }
}

/**
 * Process bulk scene search results and add to download queue
 */
async function processBulkSceneResults(
  app: FastifyInstance,
  validScenes: Array<{ subscription: any; scene: any }>,
  allTorrents: any[],
  logsService: any,
  progressService: any
) {
  const { settingsService, torrentClient } = app.container;
  const settings = await settingsService.getSettings();
  const qbittorrentConfig = settings.qbittorrent;

  let addedToQueue = 0;
  let addedToQBittorrent = 0;

  for (const { subscription, scene } of validScenes) {
    // Skip if scene is null/undefined
    if (!scene) {
      app.log.warn(`[Subscription Search] Skipping null scene for subscription ${subscription.id}`);
      continue;
    }

    // Find torrents matching this scene (simple title matching for now)
    const sceneTorrents = allTorrents.filter((t) => {
      const titleLower = t.title.toLowerCase();
      const sceneTitleLower = scene.title.toLowerCase();
      return titleLower.includes(sceneTitleLower.substring(0, 30));
    });

    if (sceneTorrents.length === 0) {
      app.log.info(`[Subscription Search] No torrents found for scene "${scene.title}"`);
      continue;
    }

    app.log.info(
      `[Subscription Search] Found ${sceneTorrents.length} torrents for scene "${scene.title}"`
    );

    // Select best torrent based on quality profile
    const selectedTorrent = await selectBestTorrentForScene(
      app,
      sceneTorrents,
      subscription.qualityProfileId
    );

    if (!selectedTorrent) {
      app.log.warn(
        `[Subscription Search] No suitable torrent for scene "${scene.title}"`
      );
      continue;
    }

    // Check if already in queue
    const existing = await app.db.query.downloadQueue.findFirst({
      where: eq(downloadQueue.torrentHash, selectedTorrent.infoHash),
    });

    if (existing) {
      app.log.info(
        `[Subscription Search] Torrent already in queue for scene "${scene.title}"`
      );
      continue;
    }

    // Create scene folder
    try {
      const { fileManagerService } = app.container;
      await fileManagerService.setupSceneFilesSimplified(scene.id);
      app.log.info(
        `[Subscription Search] ✅ Created scene folder for "${scene.title}"`
      );
    } catch (error) {
      app.log.error(
        `[Subscription Search] Failed to create folder for scene "${scene.title}": ${error}`
      );
    }

    // Add to qBittorrent if configured
    let qbitHash: string | null = null;
    if (torrentClient && qbittorrentConfig.enabled) {
      try {
        const downloadPath = settings.general.incompletePath || "/media/incomplete";

        let magnetLink: string | undefined;
        if (selectedTorrent.infoHash) {
          magnetLink = `magnet:?xt=urn:btih:${selectedTorrent.infoHash}&dn=${encodeURIComponent(selectedTorrent.title)}`;
        }

        qbitHash = await torrentClient.addTorrentAndGetHash({
          magnetLinks: magnetLink ? [magnetLink] : undefined,
          urls: selectedTorrent.downloadUrl ? [selectedTorrent.downloadUrl] : undefined,
          savePath: downloadPath,
          category: "eros",
          paused: false,
          matchInfoHash: selectedTorrent.infoHash,
          matchTitle: selectedTorrent.title,
        });

        if (qbitHash) {
          addedToQBittorrent++;
          app.log.info(
            `[Subscription Search] ✅ Added to qBittorrent: "${selectedTorrent.title}" (qbitHash: ${qbitHash})`
          );
        }
      } catch (error) {
        app.log.error(
          `[Subscription Search] Failed to add to qBittorrent: ${error}`
        );
      }
    }

    // Add to download queue database
    try {
      await app.db.insert(downloadQueue).values({
        id: nanoid(),
        sceneId: scene.id,
        torrentHash: selectedTorrent.infoHash,
        qbitHash, // Save qBittorrent hash if available
        title: selectedTorrent.title,
        size: selectedTorrent.size || 0,
        seeders: selectedTorrent.seeders || 0,
        quality: detectQualityFromTitle(selectedTorrent.title),
        status: "downloading",
        addedAt: new Date().toISOString(),
        completedAt: null,
      });

      addedToQueue++;
      app.log.info(
        `[Subscription Search] ✅ Added to queue: "${selectedTorrent.title}"`
      );
    } catch (error) {
      app.log.error(
        `[Subscription Search] Failed to add to queue: ${error}`
      );
    }
  }

  app.log.info(
    `[Subscription Search] Bulk scene results: ${addedToQueue} added to queue, ${addedToQBittorrent} to qBittorrent`
  );

  await logsService.info(
    "subscription",
    `Bulk scene results: ${addedToQueue} torrents added to download queue`,
    {
      addedToQueue,
      addedToQBittorrent,
    }
  );
}

/**
 * Select best torrent for scene based on quality profile
 */
async function selectBestTorrentForScene(
  app: FastifyInstance,
  torrents: any[],
  qualityProfileId: string
): Promise<any | null> {
  if (torrents.length === 0) return null;

  // Get quality profile
  const profile = await app.db.query.qualityProfiles.findFirst({
    where: eq(qualityProfiles.id, qualityProfileId),
  });

  if (!profile || !profile.items || profile.items.length === 0) {
    // Fallback: return torrent with most seeders
    return torrents.reduce((best, current) =>
      (current.seeders || 0) > (best.seeders || 0) ? current : best
    );
  }

  // Try each quality/source combination
  for (const item of profile.items) {
    const matching = torrents.filter((t) => {
      const quality = detectQualityFromTitle(t.title);
      const source = detectSourceFromTitle(t.title);

      const qualityMatch = item.quality === "any" || quality === item.quality;
      const sourceMatch = item.source === "any" || source === item.source;
      const minSeeders = item.minSeeders === "any" ? 0 : item.minSeeders;
      const seedersMatch = (t.seeders || 0) >= minSeeders;
      const maxSizeBytes = item.maxSize > 0 ? item.maxSize * 1024 * 1024 * 1024 : Number.MAX_SAFE_INTEGER;
      const sizeMatch = (t.size || 0) <= maxSizeBytes;

      return qualityMatch && sourceMatch && seedersMatch && sizeMatch;
    });

    if (matching.length > 0) {
      return matching.reduce((best, current) =>
        (current.seeders || 0) > (best.seeders || 0) ? current : best
      );
    }
  }

  return null;
}

/**
 * Detect quality from torrent title
 */
function detectQualityFromTitle(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("2160p") || lower.includes("4k")) return "2160p";
  if (lower.includes("1080p")) return "1080p";
  if (lower.includes("720p")) return "720p";
  if (lower.includes("480p")) return "480p";
  return "Unknown";
}

/**
 * Detect source from torrent title
 */
function detectSourceFromTitle(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("web-dl") || lower.includes("webdl")) return "WEB-DL";
  if (lower.includes("webrip")) return "WEBRip";
  if (lower.includes("bluray") || lower.includes("blu-ray")) return "BluRay";
  if (lower.includes("hdtv")) return "HDTV";
  return "Unknown";
}

/**
 * Process performer subscription - returns found scene IDs
 */
async function processPerformerSubscription(
  app: FastifyInstance,
  subscription: any,
  current: number,
  total: number
): Promise<string[]> {
  const { logsService, jobProgressService } = app.container;
  const progressService = jobProgressService;

  const entity = await app.db.query.performers.findFirst({
    where: eq(performers.id, subscription.entityId),
  });

  if (!entity) {
    await logsService.warning("subscription", "Performer not found", {
      subscriptionId: subscription.id,
      performerId: subscription.entityId,
    });
    return [];
  }

  app.log.info(`[Subscription Search] Processing performer: ${entity.name} (${current}/${total})`);

  progressService.emitProgress(
    "subscription-search",
    `Processing performer ${entity.name} (${current}/${total})`,
    current,
    total
  );

  const { torrentSearchService } = app.container;
  const selectedTorrents = await torrentSearchService.searchForSubscription(
    "performer",
    subscription.entityId,
    subscription.qualityProfileId,
    subscription.includeMetadataMissing,
    subscription.includeAliases,
    []
  );

  app.log.info(`[Subscription Search] Found ${selectedTorrents.length} torrents for ${entity.name}`);

  const foundSceneIds = new Set<string>();

  if (subscription.autoDownload && selectedTorrents.length > 0) {
    const MAX_TORRENTS_PER_RUN = 50;
    const torrentsToAdd = selectedTorrents.slice(0, MAX_TORRENTS_PER_RUN);

    app.log.info({
      autoDownload: subscription.autoDownload,
      torrentsToAdd: torrentsToAdd.length,
      firstTorrentInfoHash: torrentsToAdd[0]?.infoHash,
      firstTorrentTitle: torrentsToAdd[0]?.title,
    }, "[Subscription Search] About to process torrents for queue");

    for (const torrent of torrentsToAdd) {
      if (torrent.sceneId) {
        foundSceneIds.add(torrent.sceneId);
      }

      // Add to queue (logic from original processSubscription)
      const existing = await app.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.torrentHash, torrent.infoHash),
      });

      if (existing) {
        app.log.info({
          title: torrent.title,
          infoHash: torrent.infoHash,
          existingId: existing.id,
        }, "[Subscription Search] Skipping - torrent already in queue");
        continue;
      }

      app.log.info({
        title: torrent.title,
        infoHash: torrent.infoHash,
      }, "[Subscription Search] Adding torrent to queue");

      // Add to queue
      await addToDownloadQueue(app, torrent, subscription, entity.name);
    }
  } else {
    app.log.info({
      autoDownload: subscription.autoDownload,
      selectedTorrentsCount: selectedTorrents.length,
    }, "[Subscription Search] Skipping queue addition - autoDownload disabled or no torrents");
  }

  await logsService.info("subscription", `Performer search completed: ${entity.name}`, {
    performerId: subscription.entityId,
    torrentsFound: selectedTorrents.length,
    scenesFound: foundSceneIds.size,
  });

  return Array.from(foundSceneIds);
}

/**
 * Process studio subscription - returns found scene IDs
 */
async function processStudioSubscription(
  app: FastifyInstance,
  subscription: any,
  current: number,
  total: number
): Promise<string[]> {
  const { logsService, jobProgressService } = app.container;
  const progressService = jobProgressService;

  const entity = await app.db.query.studios.findFirst({
    where: eq(studios.id, subscription.entityId),
  });

  if (!entity) {
    await logsService.warning("subscription", "Studio not found", {
      subscriptionId: subscription.id,
      studioId: subscription.entityId,
    });
    return [];
  }

  app.log.info(`[Subscription Search] Processing studio: ${entity.name} (${current}/${total})`);

  progressService.emitProgress(
    "subscription-search",
    `Processing studio ${entity.name} (${current}/${total})`,
    current,
    total
  );

  const { torrentSearchService } = app.container;
  const selectedTorrents = await torrentSearchService.searchForSubscription(
    "studio",
    subscription.entityId,
    subscription.qualityProfileId,
    subscription.includeMetadataMissing,
    subscription.includeAliases,
    []
  );

  app.log.info(`[Subscription Search] Found ${selectedTorrents.length} torrents for ${entity.name}`);

  const foundSceneIds = new Set<string>();

  if (subscription.autoDownload && selectedTorrents.length > 0) {
    const MAX_TORRENTS_PER_RUN = 50;
    const torrentsToAdd = selectedTorrents.slice(0, MAX_TORRENTS_PER_RUN);

    for (const torrent of torrentsToAdd) {
      if (torrent.sceneId) {
        foundSceneIds.add(torrent.sceneId);
      }

      const existing = await app.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.torrentHash, torrent.infoHash),
      });

      if (existing) continue;

      await addToDownloadQueue(app, torrent, subscription, entity.name);
    }
  }

  await logsService.info("subscription", `Studio search completed: ${entity.name}`, {
    studioId: subscription.entityId,
    torrentsFound: selectedTorrents.length,
    scenesFound: foundSceneIds.size,
  });

  return Array.from(foundSceneIds);
}

/**
 * Collect scenes for individual search
 * ONLY scenes that are NOT related to any performer/studio subscription
 * Scenes from performers/studios are NEVER searched individually
 */
async function collectRemainingScenesForBulkSearch(
  app: FastifyInstance,
  performerSubscriptions: any[],
  studioSubscriptions: any[],
  sceneSubscriptions: any[],
  foundSceneIds: Set<string>
): Promise<Array<{ subscription: any; scene: any }>> {
  const bulkScenes: Array<{ subscription: any; scene: any }> = [];

  // Collect all scene IDs from performer subscriptions (through junction table)
  const performerSceneIds = new Set<string>();
  for (const sub of performerSubscriptions) {
    const performerSceneRelations = await app.db.query.performersScenes.findMany({
      where: eq(performersScenes.performerId, sub.entityId),
    });
    performerSceneRelations.forEach(relation => performerSceneIds.add(relation.sceneId));
  }

  // Collect all scene IDs from studio subscriptions
  const studioSceneIds = new Set<string>();
  for (const sub of studioSubscriptions) {
    const studioScenes = await app.db.query.scenes.findMany({
      where: eq(scenes.siteId, sub.entityId),
    });
    studioScenes.forEach(scene => studioSceneIds.add(scene.id));
  }

  // All scene IDs that are covered by performer/studio subscriptions
  const coveredSceneIds = new Set<string>();
  performerSceneIds.forEach(id => coveredSceneIds.add(id));
  studioSceneIds.forEach(id => coveredSceneIds.add(id));

  app.log.info(
    `[Subscription Search] Performer/Studios cover ${coveredSceneIds.size} scenes, will NOT search these individually`
  );

  // Only search scenes that have NO performer/studio subscription relationship
  for (const sub of sceneSubscriptions) {
    // Skip if this scene is already covered by a performer/studio subscription
    if (coveredSceneIds.has(sub.entityId)) {
      app.log.info(
        `[Subscription Search] Skipping scene ${sub.entityId} - covered by performer/studio subscription`
      );
      continue;
    }

    const scene = await app.db.query.scenes.findFirst({
      where: eq(scenes.id, sub.entityId),
    });

    if (scene) {
      bulkScenes.push({ subscription: sub, scene });
    }
  }

  app.log.info(
    `[Subscription Search] Will search ${bulkScenes.length} scenes with NO performer/studio relationship`
  );

  return bulkScenes;
}

/**
 * Add torrent to download queue
 */
async function addToDownloadQueue(
  app: FastifyInstance,
  torrent: any,
  subscription: any,
  entityName: string
) {
  const { settingsService, torrentClient, fileManagerService, indexer } = app.container;
  const settings = await settingsService.getSettings();
  const qbittorrentConfig = settings.qbittorrent;

  let sceneId = torrent.sceneId;

  // Create placeholder scene if needed
  if (!sceneId) {
    const parserService = createTorrentParserService();
    let cleanedTitle = parserService.parseTorrent(torrent.title).title;

    // Remove studio/performer name from the start of the title for metadata-less scenes
    // This prevents "Studio Name - Scene Title" from being saved as the scene title
    if (entityName) {
      const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Match at the start: "Name - ", "Name: ", "Name, ", "Name " followed by separator
      const startPattern = new RegExp(`^${escapeRegex(entityName)}\\s*[-–—:,]?\\s*`, "i");
      cleanedTitle = cleanedTitle.replace(startPattern, "").trim();
    }

    // Fallback if title became empty after cleaning
    if (cleanedTitle.length < 3) {
      cleanedTitle = parserService.parseTorrent(torrent.title).title;
    }

    const existingScene = await app.db.query.scenes.findFirst({
      where: and(eq(scenes.title, cleanedTitle), eq(scenes.hasMetadata, false)),
    });

    if (existingScene) {
      sceneId = existingScene.id;
    } else {
      sceneId = nanoid();
      await app.db.insert(scenes).values({
        id: sceneId,
        slug: cleanedTitle.toLowerCase().replace(/\s+/g, "-"),
        title: cleanedTitle,
        contentType: "scene",
        date: null,
        duration: null,
        code: null,
        images: [],
        siteId: null,
        hasMetadata: false,
        inferredFromIndexers: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Create scene-level subscription for the new metadata-less scene
      await app.db.insert(subscriptions).values({
        id: nanoid(),
        entityType: "scene",
        entityId: sceneId,
        qualityProfileId: subscription.qualityProfileId,
        autoDownload: subscription.autoDownload,
        includeMetadataMissing: false,
        includeAliases: false,
        isSubscribed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      app.log.info(
        `[Subscription Search] ✅ Created scene subscription for metadata-less scene: ${cleanedTitle}`
      );
    }
  }

  // Create scene folder
  try {
    await fileManagerService.setupSceneFilesSimplified(sceneId);
  } catch (error) {
    app.log.error(`[Subscription Search] Failed to create folder for scene ${sceneId}: ${error}`);
  }

  // Add to qBittorrent
  let qbitHash: string | null = null;

  if (subscription.autoDownload && torrentClient && qbittorrentConfig.enabled) {
    try {
      const downloadPath = settings.general.incompletePath || "/media/incomplete";
      let magnetLink: string | undefined;

      app.log.info({
        autoDownload: subscription.autoDownload,
        torrentClientExists: !!torrentClient,
        qbittorrentEnabled: qbittorrentConfig.enabled,
        downloadUrl: torrent.downloadUrl?.substring(0, 100) + "...",
        infoHash: torrent.infoHash,
      }, "[Subscription Search] qBittorrent addition check");

      // Check if downloadUrl is already a magnet link (from Prowlarr)
      if (torrent.downloadUrl?.startsWith("magnet:")) {
        magnetLink = torrent.downloadUrl;
        app.log.info({ magnetLinkLength: magnetLink.length }, "[Subscription Search] Using direct magnet link from Prowlarr");
      } else if (torrent.infoHash) {
        // Create magnet link from infoHash
        magnetLink = `magnet:?xt=urn:btih:${torrent.infoHash}&dn=${encodeURIComponent(torrent.title)}`;
        app.log.info({ infoHash: torrent.infoHash }, "[Subscription Search] Created magnet link from infoHash");
      } else if (torrent.downloadUrl && indexer?.getMagnetLink) {
        // Use indexer proxy to get magnet link from non-magnet URL
        app.log.info({ downloadUrl: torrent.downloadUrl.substring(0, 100) }, "[Subscription Search] Using indexer proxy to get magnet link");
        const proxiedMagnet = await indexer.getMagnetLink(torrent.downloadUrl);
        if (proxiedMagnet) {
          magnetLink = proxiedMagnet;
          app.log.info({ magnetLinkLength: magnetLink.length }, "[Subscription Search] Got magnet link from indexer proxy");
        }
      }

      app.log.info({
        hasMagnetLink: !!magnetLink,
        hasDownloadUrl: !!torrent.downloadUrl,
        magnetLinkPreview: magnetLink ? magnetLink.substring(0, 100) + "..." : "none",
      }, "[Subscription Search] About to call addTorrentAndGetHash");

      qbitHash = await torrentClient.addTorrentAndGetHash({
        magnetLinks: magnetLink ? [magnetLink] : undefined,
        urls: magnetLink ? undefined : (torrent.downloadUrl ? [torrent.downloadUrl] : undefined),
        savePath: downloadPath,
        category: "eros",
        paused: false,
        matchInfoHash: torrent.infoHash,
        matchTitle: torrent.title,
      });

      if (qbitHash) {
        app.log.info(`[Subscription Search] ✅ Added to qBittorrent: ${torrent.title} (qbitHash: ${qbitHash})`);
      } else if (magnetLink) {
        app.log.warn(`[Subscription Search] Failed to add torrent to qBittorrent: ${torrent.title}`);
      } else {
        app.log.warn(`[Subscription Search] No magnet link available for: ${torrent.title}`);
      }
    } catch (error) {
      app.log.error(`[Subscription Search] Failed to add to qBittorrent: ${error}`);
    }
  }

  // Add to download queue database
  try {
    await app.db.insert(downloadQueue).values({
      id: nanoid(),
      sceneId: sceneId,
      torrentHash: torrent.infoHash,
      qbitHash, // Save qBittorrent hash if available
      title: torrent.title,
      size: torrent.size || 0,
      seeders: torrent.seeders || 0,
      quality: detectQualityFromTitle(torrent.title),
      status: subscription.autoDownload ? "downloading" : "queued",
      addedAt: new Date().toISOString(),
      completedAt: null,
    });

    app.log.info(`[Subscription Search] ✅ Added to queue: ${torrent.title}`);
  } catch (error) {
    app.log.error(`[Subscription Search] Failed to add to queue: ${error}`);
  }
}
