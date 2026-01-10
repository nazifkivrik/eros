import type { Database } from "@repo/database";
import type { Logger } from "pino";
import type { SettingsService } from "../services/settings.service.js";
import type { LogsService } from "../services/logs.service.js";
import type { SubscriptionService } from "../services/subscription.service.js";
import type { TorrentSearchService } from "../services/torrent-search.service.js";
import type { FileManagerService } from "../services/file-manager.service.js";
import type { DownloadService } from "../services/download.service.js";
import type { JobProgressService } from "../services/job-progress.service.js";
import type { TorrentParserService } from "../services/parser.service.js";
import type { TorrentCompletionService } from "../services/torrent-completion.service.js";
import type { EntityResolverService } from "../services/entity-resolver.service.js";
import type { SceneMatcher } from "../services/matching/scene-matcher.service.js";
import type { AIMatchingService } from "../services/ai-matching.service.js";
import type { CrossEncoderService } from "../services/cross-encoder-matching.service.js";
import type { SpeedProfileService } from "../services/speed-profile.service.js";
import type { TPDBService } from "../services/tpdb/tpdb.service.js";
import type { StashDBService } from "../services/stashdb.service.js";
import type { QBittorrentService } from "../services/qbittorrent.service.js";
import type { ProwlarrService } from "../services/prowlarr.service.js";

// Clean Architecture - Repositories
import type { PerformersRepository } from "../infrastructure/repositories/performers.repository.js";
import type { SubscriptionsRepository } from "../infrastructure/repositories/subscriptions.repository.js";
import type { QualityProfilesRepository } from "../infrastructure/repositories/quality-profiles.repository.js";
import type { SetupRepository } from "../infrastructure/repositories/setup.repository.js";
import type { LogsRepository } from "../infrastructure/repositories/logs.repository.js";
import type { AuthRepository } from "../infrastructure/repositories/auth.repository.js";
import type { SettingsRepository } from "../infrastructure/repositories/settings.repository.js";
import type { DownloadQueueRepository } from "../infrastructure/repositories/download-queue.repository.js";
import type { SearchRepository } from "../infrastructure/repositories/search.repository.js";
import type { AIMatchScoresRepository } from "../infrastructure/repositories/ai-match-scores.repository.js";

// Clean Architecture - Application Services
import type { PerformersService } from "../application/services/performers.service.js";
import type { SubscriptionsService } from "../application/services/subscriptions.service.js";
import type { QualityProfilesService } from "../application/services/quality-profiles.service.js";
import type { SetupService } from "../application/services/setup.service.js";
import type { LogsService as NewLogsService } from "../application/services/logs.service.js";
import type { AuthService } from "../application/services/auth.service.js";
import type { TorrentsService } from "../application/services/torrents.service.js";
import type { SettingsService as NewSettingsService } from "../application/services/settings.service.js";
import type { DownloadQueueService } from "../application/services/download-queue.service.js";
import type { SearchService } from "../application/services/search.service.js";
import type { JobsService, SchedulerService } from "../application/services/jobs.service.js";

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

/**
 * Service container interface defining all available services
 * Awilix will resolve and inject these dependencies automatically
 */
export interface ServiceContainer {
  // Infrastructure
  db: Database;
  logger: Logger;

  // Core services (old structure - will be migrated)
  settingsService: SettingsService;
  logsService: LogsService;
  jobProgressService: JobProgressService;

  // Business logic services (old structure - will be migrated)
  subscriptionService: SubscriptionService;
  torrentSearchService: TorrentSearchService;
  fileManagerService: FileManagerService; // Registered in plugin with runtime config
  fileManager: FileManagerService; // Alias for legacy services (TorrentCompletionService uses this)
  downloadService: DownloadService;
  parserService: TorrentParserService;
  torrentCompletionService: TorrentCompletionService;
  entityResolverService: EntityResolverService;
  sceneMatcherService: SceneMatcher;
  aiMatchingService: AIMatchingService;
  crossEncoderService: CrossEncoderService;
  speedProfileService: SpeedProfileService;

  // External service clients (optional)
  tpdbService?: TPDBService;
  tpdb?: TPDBService; // Alias for legacy services
  stashdbService?: StashDBService;
  stashdb?: StashDBService; // Alias for legacy services
  qbittorrentService?: QBittorrentService;
  qbittorrent?: QBittorrentService; // Alias for legacy services
  prowlarrService?: ProwlarrService;
  prowlarr?: ProwlarrService; // Alias for legacy services
  scheduler?: SchedulerService;

  // === Clean Architecture Layers ===

  // Repositories (Infrastructure Layer)
  performersRepository: PerformersRepository;
  subscriptionsRepository: SubscriptionsRepository;
  qualityProfilesRepository: QualityProfilesRepository;
  setupRepository: SetupRepository;
  logsRepository: LogsRepository;
  authRepository: AuthRepository;
  settingsRepository: SettingsRepository;
  downloadQueueRepository: DownloadQueueRepository;
  searchRepository: SearchRepository;
  aiMatchScoresRepository: AIMatchScoresRepository;

  // Application Services (Business Logic Layer)
  performersService: PerformersService;
  subscriptionsService: SubscriptionsService;
  qualityProfilesService: QualityProfilesService;
  setupService: SetupService;
  newLogsService: NewLogsService; // New Clean Architecture version
  authService: AuthService;
  torrentsService: TorrentsService;
  newSettingsService: NewSettingsService; // New Clean Architecture version
  downloadQueueService: DownloadQueueService;
  searchService: SearchService;
  jobsService: JobsService;

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
}
