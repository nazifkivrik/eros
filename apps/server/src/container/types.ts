import type { Database } from "@repo/database";
import type { Logger } from "pino";
import type { FileManagerService } from "../application/services/file-management/file-manager.service.js";
import type { ExternalServicesManager } from "../config/external-services.js";
import type { DownloadService } from "../application/services/torrent-selection/download.service.js";
import type { JobProgressService } from "../infrastructure/job-progress.service.js";
import type { TorrentParserService } from "../application/services/torrent-quality/parser.service.js";
import type { EntityResolverService } from "../application/services/entity-resolver/entity-resolver.service.js";
import type { SceneMatcher } from "../application/services/matching/scene-matcher.service.js";
import type { AIMatchingService } from "../application/services/ai-matching/ai-matching.service.js";
import type { CrossEncoderService } from "../application/services/ai-matching/cross-encoder.service.js";
import type { SpeedProfileService } from "../application/services/speed-profile.service.js";

// Adapters (self-contained, no longer wrap old services)
import type { IIndexer } from "../infrastructure/adapters/interfaces/indexer.interface.js";
import type { ITorrentClient } from "../infrastructure/adapters/interfaces/torrent-client.interface.js";
import type { IMetadataProvider } from "../infrastructure/adapters/interfaces/metadata-provider.interface.js";

// Clean Architecture - Repositories
import type { PerformersRepository } from "../infrastructure/repositories/performers.repository.js";
import type { SubscriptionsRepository } from "../infrastructure/repositories/subscriptions.repository.js";
import type { ScenesRepository } from "../infrastructure/repositories/scenes.repository.js";
import type { QualityProfilesRepository } from "../infrastructure/repositories/quality-profiles.repository.js";
import type { SetupRepository } from "../infrastructure/repositories/setup.repository.js";
import type { LogsRepository } from "../infrastructure/repositories/logs.repository.js";
import type { AuthRepository } from "../infrastructure/repositories/auth.repository.js";
import type { SettingsRepository } from "../infrastructure/repositories/settings.repository.js";
import type { DownloadQueueRepository } from "../infrastructure/repositories/download-queue.repository.js";
import type { SearchRepository } from "../infrastructure/repositories/search.repository.js";
import type { AIMatchScoresRepository } from "../infrastructure/repositories/ai-match-scores.repository.js";
import type { TorrentsRepository } from "../infrastructure/repositories/torrents.repository.js";

// Clean Architecture - Application Services
import type { PerformersService } from "../application/services/performers.service.js";
import type { SubscriptionsService } from "../application/services/subscriptions.service.js";
import type { SubscriptionsCoreService } from "../application/services/subscriptions/subscriptions.core.service.js";
import type { SubscriptionsScenesService } from "../application/services/subscriptions/subscriptions.scenes.service.js";
import type { SubscriptionsDiscoveryService } from "../application/services/subscriptions/subscriptions.discovery.service.js";
import type { SubscriptionsManagementService } from "../application/services/subscriptions/subscriptions.management.service.js";
import type { SubscriptionsTorrentService } from "../application/services/subscriptions/subscriptions.torrent.service.js";
import type { QualityProfilesService } from "../application/services/quality-profiles.service.js";
import type { SetupService } from "../application/services/setup.service.js";
import type { LogsService } from "../application/services/logs.service.js";
import type { AuthService } from "../application/services/auth.service.js";
import type { TorrentsService } from "../application/services/torrents.service.js";
import type { SettingsService as NewSettingsService } from "../application/services/settings.service.js";
import type { DownloadQueueService } from "../application/services/download-queue.service.js";
import type { SearchService } from "../application/services/search.service.js";
import type { JobsService } from "../application/services/jobs.service.js";
import type { SchedulerService } from "../application/services/scheduler.service.js";
import type { TorrentCompletionHandlerService } from "../application/services/torrent-completion/torrent-completion.handler.service.js";

// Clean Architecture - Controllers
import type { PerformersController } from "../interfaces/controllers/performers.controller.js";
import type { SubscriptionsController } from "../interfaces/controllers/subscriptions.controller.js";
import type { QualityProfilesController } from "../interfaces/controllers/quality-profiles.controller.js";
import type { SetupController } from "../interfaces/controllers/setup.controller.js";
import type { LogsController } from "../interfaces/controllers/logs.controller.js";
import type { AuthController } from "../interfaces/controllers/auth.controller.js";
import type { TorrentsController } from "../interfaces/controllers/torrents.controller.js";
import type { SettingsController } from "../interfaces/controllers/settings.controller.js";
import type { DownloadQueueController } from "../interfaces/controllers/download-queue.controller.js";
import type { SearchController } from "../interfaces/controllers/search.controller.js";
import type { JobsController } from "../interfaces/controllers/jobs.controller.js";
import type { TorrentSearchController } from "../interfaces/controllers/torrent-search.controller.js";
import type { TorrentSearchService } from "../application/services/torrent-search/index.js";

// Clean Architecture - Jobs
import type { CleanupJob } from "../application/jobs/cleanup.job.js";
import type { SubscriptionSearchJob } from "../application/jobs/subscription-search.job.js";
import type { TorrentMonitorJob } from "../application/jobs/torrent-monitor.job.js";
import type { MetadataRefreshJob } from "../application/jobs/metadata-refresh.job.js";

/**
 * Service container interface defining all available services
 * Awilix will resolve and inject these dependencies automatically
 */
export interface ServiceContainer {
  // Infrastructure
  db: Database;
  logger: Logger;
  externalServicesManager: ExternalServicesManager;

  // SSE for job progress (infrastructure)
  jobProgressService: JobProgressService;

  // Legacy services (will be migrated)
  settingsService: NewSettingsService;
  torrentSearchService: TorrentSearchService; // New Clean Architecture version
  fileManagerService: FileManagerService;
  fileManager: FileManagerService;
  downloadService: DownloadService;
  parserService: TorrentParserService;
  entityResolverService: EntityResolverService;
  sceneMatcherService: SceneMatcher;
  aiMatchingService: AIMatchingService;
  crossEncoderService: CrossEncoderService;
  speedProfileService: SpeedProfileService;

  // External service adapters (optional)
  // Note: Adapters are registered with legacy names for backward compatibility
  indexer?: IIndexer;
  torrentClient?: ITorrentClient;
  tpdbProvider?: IMetadataProvider;
  stashdbProvider?: IMetadataProvider;
  scheduler?: SchedulerService; // Alias for schedulerService

  // Generic metadata provider (picks first available)
  metadataProvider?: IMetadataProvider | undefined;

  // === Clean Architecture Layers ===

  // Repositories (Infrastructure Layer)
  performersRepository: PerformersRepository;
  subscriptionsRepository: SubscriptionsRepository;
  scenesRepository: ScenesRepository;
  qualityProfilesRepository: QualityProfilesRepository;
  setupRepository: SetupRepository;
  logsRepository: LogsRepository;
  authRepository: AuthRepository;
  settingsRepository: SettingsRepository;
  downloadQueueRepository: DownloadQueueRepository;
  searchRepository: SearchRepository;
  aiMatchScoresRepository: AIMatchScoresRepository;
  torrentsRepository: TorrentsRepository;

  // Application Services (Business Logic Layer)
  performersService: PerformersService;
  subscriptionsService: SubscriptionsService;
  subscriptionsCoreService: SubscriptionsCoreService;
  subscriptionsScenesService: SubscriptionsScenesService;
  subscriptionsDiscoveryService: SubscriptionsDiscoveryService;
  subscriptionsManagementService: SubscriptionsManagementService;
  subscriptionsTorrentService: SubscriptionsTorrentService;
  qualityProfilesService: QualityProfilesService;
  setupService: SetupService;
  logsService: LogsService;
  authService: AuthService;
  torrentsService: TorrentsService;
  downloadQueueService: DownloadQueueService;
  searchService: SearchService;
  jobsService: JobsService;
  schedulerService: SchedulerService;
  torrentCompletionService: TorrentCompletionHandlerService;

  // Jobs (Background Tasks)
  cleanupJob: CleanupJob;
  subscriptionSearchJob: SubscriptionSearchJob;
  torrentMonitorJob: TorrentMonitorJob;
  metadataRefreshJob: MetadataRefreshJob;

  // Controllers (Interface Layer)
  performersController: PerformersController;
  subscriptionsController: SubscriptionsController;
  qualityProfilesController: QualityProfilesController;
  setupController: SetupController;
  logsController: LogsController;
  authController: AuthController;
  torrentsController: TorrentsController;
  settingsController: SettingsController;
  downloadQueueController: DownloadQueueController;
  searchController: SearchController;
  jobsController: JobsController;
  torrentSearchController: TorrentSearchController;
}
