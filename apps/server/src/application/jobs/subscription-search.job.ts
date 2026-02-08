/**
 * Subscription Search Job
 * Searches for new scenes for subscribed performers/studios
 * Runs every 6 hours
 */

import { BaseJob } from "./base.job.js";
import type { Logger } from "pino";
import type { JobProgressService } from "@/infrastructure/job-progress.service.js";
import type { SubscriptionsRepository } from "@/infrastructure/repositories/subscriptions.repository.js";
import type { DownloadQueueRepository } from "@/infrastructure/repositories/download-queue.repository.js";
import type { LogsService } from "../../application/services/logs.service.js";
import type { TorrentSearchService } from "../../application/services/torrent-search/index.js";
import type { TorrentClientRegistry } from "@/infrastructure/registries/provider-registry.js";
import type { ITorrentClient } from "@/infrastructure/adapters/interfaces/torrent-client.interface.js";
import type { FileManagerService } from "../../application/services/file-management/file-manager.service.js";
import type { SettingsService } from "../../application/services/settings.service.js";
import type { DownloadQueueService } from "../../application/services/download-queue.service.js";
import type { CrossEncoderService } from "../../application/services/ai-matching/cross-encoder.service.js";
import type { Database } from "@repo/database";
import { eq, and } from "drizzle-orm";
import { subscriptions, performers, studios, scenes, downloadQueue, performersScenes, sceneFiles } from "@repo/database";
import { nanoid } from "nanoid";

const MAX_TORRENTS_PER_RUN = 50;

export class SubscriptionSearchJob extends BaseJob {
  readonly name = "subscription-search";
  readonly description = "Search for new content from subscribed performers and studios";

  private subscriptionsRepository: SubscriptionsRepository;
  private downloadQueueRepository: DownloadQueueRepository;
  private logsService: LogsService;
  private torrentSearchService: TorrentSearchService;
  private torrentClientRegistry: TorrentClientRegistry;
  private fileManager: FileManagerService;
  private settingsService: SettingsService;
  private downloadQueueService: DownloadQueueService;
  private crossEncoderService: CrossEncoderService | undefined;
  private db: Database;

  constructor(deps: {
    logger: Logger;
    jobProgressService: JobProgressService;
    subscriptionsRepository: SubscriptionsRepository;
    downloadQueueRepository: DownloadQueueRepository;
    logsService: LogsService;
    torrentSearchService: TorrentSearchService;
    torrentClientRegistry: TorrentClientRegistry;
    fileManager: FileManagerService;
    settingsService: SettingsService;
    downloadQueueService: DownloadQueueService;
    crossEncoderService: CrossEncoderService | undefined;
    db: Database;
  }) {
    super(deps);
    this.subscriptionsRepository = deps.subscriptionsRepository;
    this.downloadQueueRepository = deps.downloadQueueRepository;
    this.logsService = deps.logsService;
    this.torrentSearchService = deps.torrentSearchService;
    this.torrentClientRegistry = deps.torrentClientRegistry;
    this.fileManager = deps.fileManager;
    this.settingsService = deps.settingsService;
    this.downloadQueueService = deps.downloadQueueService;
    this.crossEncoderService = deps.crossEncoderService;
    this.db = deps.db;
  }

  /**
   * Get the primary torrent client
   */
  private getTorrentClient(): ITorrentClient | undefined {
    const primary = this.torrentClientRegistry.getPrimary();
    return primary?.provider;
  }

  async execute(): Promise<void> {
    this.emitStarted("Starting subscription search job");
    this.logger.info("Starting subscription search job");

    try {
      // Ensure AI model is loaded before starting search if Cross-Encoder is enabled
      const settings = await this.settingsService.getSettings();
      if (settings.ai.useCrossEncoder && this.crossEncoderService) {
        this.emitProgress("Ensuring AI model is ready...", 0, 0);
        await this.crossEncoderService.initialize();
        this.logger.info("AI model is ready for matching");
      }
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
            {
              error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
              subscriptionId: subscription.id,
              performerId: subscription.entityId,
            },
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
            {
              error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
              subscriptionId: subscription.id,
              studioId: subscription.entityId,
            },
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

      // Retry failed torrents with longer interval (30 min instead of 5)
      await this.retryFailedTorrents();
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
    // Check if subscription is still active before adding
    if (!subscription.isSubscribed) {
      this.logger.info(`Subscription ${subscription.id} is unsubscribed, skipping queue`);
      return;
    }

    // Get or create scene ID
    let sceneId = torrent.sceneId;
    if (!sceneId) {
      sceneId = await this.createPlaceholderScene(torrent, entityName, subscription);
    }

    // For scene subscriptions, verify the scene subscription is still active
    if (subscription.entityType === "scene") {
      const currentSub = await this.subscriptionsRepository.findById(subscription.id);
      if (!currentSub || !currentSub.isSubscribed) {
        this.logger.info(`Scene subscription ${subscription.id} is unsubscribed, skipping queue`);
        return;
      }
    }

    // Check if scene already has files (already downloaded)
    const existingFiles = await this.db.query.sceneFiles.findFirst({
      where: eq(sceneFiles.sceneId, sceneId),
    });

    if (existingFiles) {
      this.logger.info(`Scene already has files, skipping: ${torrent.title}`);
      return;
    }

    // Check by scene ID (more comprehensive than hash)
    const existingByScene = await this.db.query.downloadQueue.findFirst({
      where: eq(downloadQueue.sceneId, sceneId),
    });

    if (existingByScene) {
      this.logger.info(`Scene already in queue, skipping: ${torrent.title}`);
      return;
    }

    // Also check by torrent hash for torrents that don't have sceneId yet
    if (torrent.infoHash) {
      const existingByHash = await this.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.torrentHash, torrent.infoHash),
      });

      if (existingByHash) {
        this.logger.info(`Torrent already in queue, skipping: ${torrent.title}`);
        return;
      }
    }

    // Create scene folder
    try {
      await this.fileManager.setupSceneFilesSimplified(sceneId);
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

    const torrentClient = this.getTorrentClient();
    if (torrentClient && subscription.autoDownload) {
      const settings = await this.settingsService.getSettings();
      const qbittorrentConfig = settings.qbittorrent;

      if (qbittorrentConfig.enabled && (torrent.downloadUrl || torrent.infoHash)) {
        try {
          const downloadPath = settings.general.incompletePath || "/media/incomplete";

          let magnetLink: string | undefined;
          let torrentUrl: string | undefined;

          // Priority 1: Use infoHash to create magnet link (most reliable)
          if (torrent.infoHash) {
            magnetLink = `magnet:?xt=urn:btih:${torrent.infoHash}&dn=${encodeURIComponent(torrent.title)}`;
          }
          // Priority 2: Use downloadUrl if it's already a magnet link
          else if (torrent.downloadUrl?.startsWith("magnet:")) {
            magnetLink = torrent.downloadUrl;
          }
          // Priority 3: Use downloadUrl as torrent URL (for .torrent files)
          else if (torrent.downloadUrl) {
            torrentUrl = torrent.downloadUrl;
          }

          this.logger.info({
            title: torrent.title,
            hasMagnetLink: !!magnetLink,
            hasTorrentUrl: !!torrentUrl,
            hasInfoHash: !!torrent.infoHash,
          }, "Attempting to add torrent to client");

          qbitHash = await torrentClient.addTorrentAndGetHash({
            magnetLinks: magnetLink ? [magnetLink] : undefined,
            urls: torrentUrl ? [torrentUrl] : undefined,
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
            this.logger.error(`Failed to add to qBittorrent: ${torrent.title} (addTorrentAndGetHash returned null)`);
          }
        } catch (error) {
          dbStatus = "add_failed";
          this.logger.error({ error }, `Failed to add to qBittorrent: ${torrent.title}`);
        }
      } else {
        this.logger.warn({
          title: torrent.title,
          qbittorrentEnabled: qbittorrentConfig.enabled,
          hasDownloadUrl: !!torrent.downloadUrl,
          hasInfoHash: !!torrent.infoHash,
        }, "Skipping torrent client addition - qBittorrent disabled or no magnet/infoHash available");
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

  /**
   * Retry failed torrents with longer interval (30 min)
   * Called at the end of subscription search job
   * @private
   */
  private async retryFailedTorrents(): Promise<void> {
    const maxAttempts = 5;
    const retryAfterMinutes = 30; // Longer interval for subscription job (runs every 6 hours)

    const failedItems = await this.downloadQueueRepository.findAddFailedItems(
      maxAttempts,
      retryAfterMinutes
    );

    this.logger.info({ count: failedItems.length }, "Found failed torrents to retry");

    let successCount = 0;
    let permanentFailures = 0;

    for (const item of failedItems) {
      const shouldRetry = (item.addToClientAttempts || 0) < maxAttempts;

      if (!shouldRetry) {
        this.logger.warn(
          { id: item.id, attempts: item.addToClientAttempts },
          "Max retry attempts reached, giving up"
        );
        permanentFailures++;
        continue;
      }

      // Check isSubscribed before retrying
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, item.sceneId),
      });

      if (!scene || !scene.isSubscribed) {
        this.logger.info({ sceneId: item.sceneId }, "Scene unsubscribed, skipping retry");
        continue;
      }

      // Reconstruct magnet link if torrentHash is available
      const magnetLink = item.torrentHash
        ? `magnet:?xt=urn:btih:${item.torrentHash}&dn=${encodeURIComponent(item.title)}`
        : undefined;

      const success = await this.downloadQueueService.retrySingleTorrent(item.id);

      if (success.success) {
        successCount++;
      }
    }

    this.logger.info(
      {
        total: failedItems.length,
        succeeded: successCount,
        permanentFailures,
      },
      "Retry operation completed"
    );
  }
}
