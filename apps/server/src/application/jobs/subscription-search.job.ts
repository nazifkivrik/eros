/**
 * Subscription Search Job
 * Searches for new scenes for subscribed performers/studios
 * Runs every 6 hours
 */

import { BaseJob } from "./base.job.js";
import type { Logger } from "pino";
import type { JobProgressService } from "../../infrastructure/job-progress.service.js";
import type { SubscriptionsRepository } from "../../infrastructure/repositories/subscriptions.repository.js";
import type { DownloadQueueRepository } from "../../infrastructure/repositories/download-queue.repository.js";
import type { LogsService } from "../../application/services/logs.service.js";
import type { TorrentSearchService } from "../../application/services/torrent-search/index.js";
import type { ITorrentClient } from "../../infrastructure/adapters/interfaces/torrent-client.interface.js";
import type { FileManagerService } from "../../application/services/file-management/file-manager.service.js";
import type { SettingsService } from "../../application/services/settings.service.js";
import type { Database } from "@repo/database";
import { eq, and } from "drizzle-orm";
import { subscriptions, performers, studios, scenes, downloadQueue, performersScenes } from "@repo/database";
import { nanoid } from "nanoid";

const MAX_TORRENTS_PER_RUN = 50;

export class SubscriptionSearchJob extends BaseJob {
  readonly name = "subscription-search";
  readonly description = "Search for new content from subscribed performers and studios";

  private subscriptionsRepository: SubscriptionsRepository;
  private downloadQueueRepository: DownloadQueueRepository;
  private logsService: LogsService;
  private torrentSearchService: TorrentSearchService;
  private torrentClient: ITorrentClient | undefined;
  private fileManagerService: FileManagerService;
  private settingsService: SettingsService;
  private db: Database;

  constructor(deps: {
    logger: Logger;
    progressService: JobProgressService;
    subscriptionsRepository: SubscriptionsRepository;
    downloadQueueRepository: DownloadQueueRepository;
    logsService: LogsService;
    torrentSearchService: TorrentSearchService;
    torrentClient: ITorrentClient | undefined;
    fileManagerService: FileManagerService;
    settingsService: SettingsService;
    db: Database;
  }) {
    super(deps);
    this.subscriptionsRepository = deps.subscriptionsRepository;
    this.downloadQueueRepository = deps.downloadQueueRepository;
    this.logsService = deps.logsService;
    this.torrentSearchService = deps.torrentSearchService;
    this.torrentClient = deps.torrentClient;
    this.fileManagerService = deps.fileManagerService;
    this.settingsService = deps.settingsService;
    this.db = deps.db;
  }

  async execute(): Promise<void> {
    this.emitStarted("Starting subscription search job");
    this.logger.info("Starting subscription search job");

    try {
      // Get all active subscriptions
      const activeSubscriptions = await this.getActiveSubscriptions();

      this.logger.info(
        `Found ${activeSubscriptions.length} active subscriptions to process`
      );

      this.emitProgress(
        `Found ${activeSubscriptions.length} active subscriptions`,
        0,
        activeSubscriptions.length,
        { totalSubscriptions: activeSubscriptions.length }
      );

      // Separate subscriptions by type
      const performerSubscriptions = activeSubscriptions.filter(s => s.entityType === "performer");
      const studioSubscriptions = activeSubscriptions.filter(s => s.entityType === "studio");
      const sceneSubscriptions = activeSubscriptions.filter(s => s.entityType === "scene");

      this.logger.info(
        `Processing ${performerSubscriptions.length} performers, ${studioSubscriptions.length} studios, ${sceneSubscriptions.length} scene subscriptions`
      );

      // Step 1: Process performer subscriptions
      const foundSceneIds = new Set<string>();
      for (let i = 0; i < performerSubscriptions.length; i++) {
        const subscription = performerSubscriptions[i];
        try {
          const foundIds = await this.processPerformerSubscription(
            subscription,
            i + 1,
            performerSubscriptions.length
          );
          foundIds.forEach(id => foundSceneIds.add(id));
        } catch (error) {
          this.logger.error(
            { error, subscriptionId: subscription.id },
            "Failed to process performer subscription"
          );
        }
      }

      // Step 2: Process studio subscriptions
      for (let i = 0; i < studioSubscriptions.length; i++) {
        const subscription = studioSubscriptions[i];
        try {
          const foundIds = await this.processStudioSubscription(
            subscription,
            i + 1,
            studioSubscriptions.length
          );
          foundIds.forEach(id => foundSceneIds.add(id));
        } catch (error) {
          this.logger.error(
            { error, subscriptionId: subscription.id },
            "Failed to process studio subscription"
          );
        }
      }

      this.logger.info(
        `Found torrents for ${foundSceneIds.size} scenes from performer/studio subscriptions`
      );

      // Step 3: Process scene subscriptions with bulk search
      await this.processSceneSubscriptions(
        sceneSubscriptions,
        performerSubscriptions,
        studioSubscriptions,
        foundSceneIds
      );

      this.emitCompleted(
        `Completed processing ${activeSubscriptions.length} subscriptions`,
        { totalProcessed: activeSubscriptions.length }
      );

      this.logger.info("Subscription search job completed");
    } catch (error) {
      this.emitFailed(
        `Job failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      this.logger.error({ error }, "Subscription search job failed");
      throw error;
    }
  }

  private async getActiveSubscriptions() {
    return await this.db.query.subscriptions.findMany({
      where: eq(subscriptions.isSubscribed, true),
    });
  }

  private async processPerformerSubscription(
    subscription: any,
    current: number,
    total: number
  ): Promise<string[]> {
    const entity = await this.db.query.performers.findFirst({
      where: eq(performers.id, subscription.entityId),
    });

    if (!entity) {
      await this.logsService.warning("subscription", "Performer not found", {
        subscriptionId: subscription.id,
        performerId: subscription.entityId,
      });
      return [];
    }

    this.logger.info(`Processing performer: ${entity.name} (${current}/${total})`);

    this.emitProgress(
      `Processing performer ${entity.name} (${current}/${total})`,
      current,
      total
    );

    const selectedTorrents = await this.torrentSearchService.searchForSubscription(
      "performer",
      subscription.entityId,
      subscription.qualityProfileId,
      subscription.includeMetadataMissing,
      subscription.includeAliases,
      []
    );

    this.logger.info(`Found ${selectedTorrents.length} torrents for ${entity.name}`);

    const foundSceneIds = new Set<string>();

    if (subscription.autoDownload && selectedTorrents.length > 0) {
      const torrentsToAdd = selectedTorrents.slice(0, MAX_TORRENTS_PER_RUN);

      for (const torrent of torrentsToAdd) {
        if (torrent.sceneId) {
          foundSceneIds.add(torrent.sceneId);
        }

        await this.addToDownloadQueue(torrent, subscription, entity.name);
      }
    }

    await this.logsService.info("subscription", `Performer search completed: ${entity.name}`, {
      performerId: subscription.entityId,
      torrentsFound: selectedTorrents.length,
      scenesFound: foundSceneIds.size,
    });

    return Array.from(foundSceneIds);
  }

  private async processStudioSubscription(
    subscription: any,
    current: number,
    total: number
  ): Promise<string[]> {
    const entity = await this.db.query.studios.findFirst({
      where: eq(studios.id, subscription.entityId),
    });

    if (!entity) {
      await this.logsService.warning("subscription", "Studio not found", {
        subscriptionId: subscription.id,
        studioId: subscription.entityId,
      });
      return [];
    }

    this.logger.info(`Processing studio: ${entity.name} (${current}/${total})`);

    this.emitProgress(
      `Processing studio ${entity.name} (${current}/${total})`,
      current,
      total
    );

    const selectedTorrents = await this.torrentSearchService.searchForSubscription(
      "studio",
      subscription.entityId,
      subscription.qualityProfileId,
      subscription.includeMetadataMissing,
      subscription.includeAliases,
      []
    );

    this.logger.info(`Found ${selectedTorrents.length} torrents for ${entity.name}`);

    const foundSceneIds = new Set<string>();

    if (subscription.autoDownload && selectedTorrents.length > 0) {
      const torrentsToAdd = selectedTorrents.slice(0, MAX_TORRENTS_PER_RUN);

      for (const torrent of torrentsToAdd) {
        if (torrent.sceneId) {
          foundSceneIds.add(torrent.sceneId);
        }

        await this.addToDownloadQueue(torrent, subscription, entity.name);
      }
    }

    await this.logsService.info("subscription", `Studio search completed: ${entity.name}`, {
      studioId: subscription.entityId,
      torrentsFound: selectedTorrents.length,
      scenesFound: foundSceneIds.size,
    });

    return Array.from(foundSceneIds);
  }

  private async processSceneSubscriptions(
    sceneSubscriptions: any[],
    performerSubscriptions: any[],
    studioSubscriptions: any[],
    foundSceneIds: Set<string>
  ): Promise<void> {
    // Collect remaining scenes for bulk search
    const bulkScenes = await this.collectRemainingScenesForBulkSearch(
      performerSubscriptions,
      studioSubscriptions,
      sceneSubscriptions,
      foundSceneIds
    );

    this.logger.info(`Bulk searching ${bulkScenes.length} remaining scenes`);

    if (bulkScenes.length > 0) {
      await this.processBulkSceneSearch(bulkScenes);
    } else {
      this.logger.info("No remaining scenes for bulk search");
    }
  }

  private async collectRemainingScenesForBulkSearch(
    performerSubscriptions: any[],
    studioSubscriptions: any[],
    sceneSubscriptions: any[],
    _foundSceneIds: Set<string>
  ): Promise<Array<{ subscription: any; scene: any }>> {
    const bulkScenes: Array<{ subscription: any; scene: any }> = [];

    // Collect all scene IDs from performer subscriptions
    const performerSceneIds = new Set<string>();
    for (const sub of performerSubscriptions) {
      const performerSceneRelations = await this.db.query.performersScenes.findMany({
        where: eq(performersScenes.performerId, sub.entityId),
      });
      performerSceneRelations.forEach(relation => performerSceneIds.add(relation.sceneId));
    }

    // Collect all scene IDs from studio subscriptions
    const studioSceneIds = new Set<string>();
    for (const sub of studioSubscriptions) {
      const studioScenes = await this.db.query.scenes.findMany({
        where: eq(scenes.siteId, sub.entityId),
      });
      studioScenes.forEach(scene => studioSceneIds.add(scene.id));
    }

    // All scene IDs that are covered by performer/studio subscriptions
    const coveredSceneIds = new Set<string>();
    performerSceneIds.forEach(id => coveredSceneIds.add(id));
    studioSceneIds.forEach(id => coveredSceneIds.add(id));

    this.logger.info(
      `Performer/Studios cover ${coveredSceneIds.size} scenes, will NOT search these individually`
    );

    // Only search scenes that have NO performer/studio subscription relationship
    for (const sub of sceneSubscriptions) {
      if (coveredSceneIds.has(sub.entityId)) {
        this.logger.info(
          `Skipping scene ${sub.entityId} - covered by performer/studio subscription`
        );
        continue;
      }

      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, sub.entityId),
      });

      if (scene) {
        bulkScenes.push({ subscription: sub, scene });
      }
    }

    this.logger.info(
      `Will search ${bulkScenes.length} scenes with NO performer/studio relationship`
    );

    return bulkScenes;
  }

  private async processBulkSceneSearch(
    sceneSubscriptions: Array<{ subscription: any; scene: any }>
  ): Promise<void> {
    const validScenes = sceneSubscriptions.filter((sd) => sd.scene !== null);

    this.logger.info(`Bulk searching ${validScenes.length} valid scenes`);

    if (validScenes.length === 0) {
      return;
    }

    const settings = await this.settingsService.getSettings();
    const prowlarrConfig = settings.prowlarr;

    if (!prowlarrConfig.enabled || !prowlarrConfig.apiUrl || !prowlarrConfig.apiKey) {
      this.logger.warn("Prowlarr not configured, skipping bulk scene search");
      return;
    }

    // For each scene, search for torrents using TorrentSearchService
    for (const { subscription, scene } of validScenes) {
      try {
        const selectedTorrents = await this.torrentSearchService.searchForSubscription(
          "scene",
          scene.id,
          subscription.qualityProfileId,
          false,
          false,
          []
        );

        if (selectedTorrents.length > 0 && subscription.autoDownload) {
          const torrent = selectedTorrents[0]; // Take the first/best match
          await this.addToDownloadQueue(torrent, subscription, scene.title);
        }
      } catch (error) {
        this.logger.error(
          { error, sceneId: scene.id },
          `Failed to search for scene ${scene.title}`
        );
      }
    }
  }

  private async addToDownloadQueue(
    torrent: any,
    subscription: any,
    entityName: string
  ): Promise<void> {
    // Check if torrent already exists in queue
    const existing = await this.db.query.downloadQueue.findFirst({
      where: eq(downloadQueue.torrentHash, torrent.infoHash),
    });

    if (existing) {
      this.logger.info(`Torrent already in queue, skipping: ${torrent.title}`);
      return;
    }

    // Get or create scene ID
    let sceneId = torrent.sceneId;
    if (!sceneId) {
      sceneId = await this.createPlaceholderScene(torrent, entityName, subscription);
    }

    // Create scene folder
    try {
      await this.fileManagerService.setupSceneFilesSimplified(sceneId);
      this.logger.info(`Created scene folder for ${torrent.title}`);
    } catch (error) {
      this.logger.error(
        { error, sceneId },
        `Failed to create scene folder for ${torrent.title}`
      );
    }

    // Add to qBittorrent if configured
    let qbitHash: string | null = null;
    let dbStatus: "queued" | "downloading" | "add_failed" = "queued";

    if (this.torrentClient && subscription.autoDownload) {
      const settings = await this.settingsService.getSettings();
      const qbittorrentConfig = settings.qbittorrent;

      if (qbittorrentConfig.enabled && (torrent.downloadUrl || torrent.infoHash)) {
        try {
          const downloadPath = settings.general.incompletePath || "/media/incomplete";

          let magnetLink: string | undefined;
          if (torrent.infoHash) {
            magnetLink = `magnet:?xt=urn:btih:${torrent.infoHash}&dn=${encodeURIComponent(torrent.title)}`;
          } else if (torrent.downloadUrl?.startsWith("magnet:")) {
            magnetLink = torrent.downloadUrl;
          }

          qbitHash = await this.torrentClient.addTorrentAndGetHash({
            magnetLinks: magnetLink ? [magnetLink] : undefined,
            urls: magnetLink ? undefined : (torrent.downloadUrl ? [torrent.downloadUrl] : undefined),
            savePath: downloadPath,
            category: "eros",
            paused: false,
            matchInfoHash: torrent.infoHash,
            matchTitle: torrent.title,
          });

          if (qbitHash) {
            dbStatus = "downloading";
            this.logger.info(`Added to qBittorrent: ${torrent.title} (qbitHash: ${qbitHash})`);
          } else {
            dbStatus = "add_failed";
            this.logger.error(`Failed to add to qBittorrent: ${torrent.title}`);
          }
        } catch (error) {
          dbStatus = "add_failed";
          this.logger.error({ error }, `Failed to add to qBittorrent: ${torrent.title}`);
        }
      }
    }

    // Add to download queue database
    await this.db.insert(downloadQueue).values({
      id: nanoid(),
      sceneId: sceneId,
      torrentHash: torrent.infoHash,
      qbitHash,
      title: torrent.title,
      size: torrent.size,
      seeders: torrent.seeders,
      quality: torrent.quality,
      status: dbStatus,
      addedAt: new Date().toISOString(),
      completedAt: null,
    });

    this.logger.info(`Added to database queue: ${torrent.title}`);
  }

  private async createPlaceholderScene(torrent: any, entityName: string, subscription: any): Promise<string> {
    // Import parser service dynamically
    const { createTorrentParserService } = await import("../../application/services/torrent-quality/parser.service.js");
    const parserService = createTorrentParserService();
    const cleanedTitle = parserService.parseTorrent(torrent.title).title;

    // Remove entity name from title if present
    let finalTitle = cleanedTitle;
    if (entityName) {
      const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const startPattern = new RegExp(`^${escapeRegex(entityName)}\\s*[-–—:,]?\\s*`, "i");
      finalTitle = cleanedTitle.replace(startPattern, "").trim();
    }

    if (finalTitle.length < 3) {
      finalTitle = cleanedTitle;
    }

    // Check if scene already exists
    const existingScene = await this.db.query.scenes.findFirst({
      where: and(eq(scenes.title, finalTitle), eq(scenes.hasMetadata, false)),
    });

    if (existingScene) {
      // Create scene subscription if not exists
      const existingSubscription = await this.db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.entityType, "scene"),
          eq(subscriptions.entityId, existingScene.id)
        ),
      });

      if (!existingSubscription) {
        await this.db.insert(subscriptions).values({
          id: nanoid(),
          entityType: "scene",
          entityId: existingScene.id,
          qualityProfileId: subscription.qualityProfileId,
          autoDownload: subscription.autoDownload,
          includeMetadataMissing: false,
          includeAliases: false,
          isSubscribed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      return existingScene.id;
    }

    // Create new placeholder scene
    const sceneId = nanoid();
    await this.db.insert(scenes).values({
      id: sceneId,
      slug: finalTitle.toLowerCase().replace(/\s+/g, "-"),
      title: finalTitle,
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

    // Create scene subscription
    await this.db.insert(subscriptions).values({
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

    this.logger.info(`Created placeholder scene: ${finalTitle}`);
    return sceneId;
  }
}
