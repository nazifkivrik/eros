import { createContainer, asClass, asValue, InjectionMode } from "awilix";
import type { Database } from "@repo/database";
import type { Logger } from "pino";
import type { ServiceContainer } from "./types.js";

// Old structure - Service imports (will be migrated)
import { SettingsService } from "../services/settings.service.js";
import { LogsService } from "../services/logs.service.js";
import { JobProgressService } from "../services/job-progress.service.js";
import { SubscriptionService } from "../services/subscription.service.js";
import { TorrentSearchService } from "../services/torrent-search.service.js";
import { DownloadService } from "../services/download.service.js";
// FileManagerService is registered in plugin with runtime config
import { TorrentParserService } from "../services/parser.service.js";
import { TorrentCompletionService } from "../services/torrent-completion.service.js";
import { EntityResolverService } from "../services/entity-resolver.service.js";
import { SceneMatcher } from "../services/matching/scene-matcher.service.js";
import { AIMatchingService } from "../services/ai-matching.service.js";
import { CrossEncoderService } from "../services/cross-encoder-matching.service.js";
import { SpeedProfileService } from "../services/speed-profile.service.js";
import { TPDBService } from "../services/tpdb/tpdb.service.js";
import { StashDBService } from "../services/stashdb.service.js";
import { QBittorrentService } from "../services/qbittorrent.service.js";
import { ProwlarrService } from "../services/prowlarr.service.js";

// Clean Architecture - Repositories
import { PerformersRepository } from "../infrastructure/repositories/performers.repository.js";
import { SubscriptionsRepository } from "../infrastructure/repositories/subscriptions.repository.js";
import { QualityProfilesRepository } from "../infrastructure/repositories/quality-profiles.repository.js";
import { SetupRepository } from "../infrastructure/repositories/setup.repository.js";
import { LogsRepository } from "../infrastructure/repositories/logs.repository.js";
import { AuthRepository } from "../infrastructure/repositories/auth.repository.js";
import { SettingsRepository } from "../infrastructure/repositories/settings.repository.js";
import { DownloadQueueRepository } from "../infrastructure/repositories/download-queue.repository.js";
import { SearchRepository } from "../infrastructure/repositories/search.repository.js";
import { AIMatchScoresRepository } from "../infrastructure/repositories/ai-match-scores.repository.js";

// Clean Architecture - Application Services
import { PerformersService } from "../application/services/performers.service.js";
import { SubscriptionsService } from "../application/services/subscriptions.service.js";
import { QualityProfilesService } from "../application/services/quality-profiles.service.js";
import { SetupService } from "../application/services/setup.service.js";
import { LogsService as NewLogsService } from "../application/services/logs.service.js";
import { AuthService } from "../application/services/auth.service.js";
import { TorrentsService } from "../application/services/torrents.service.js";
import { SettingsService as NewSettingsService } from "../application/services/settings.service.js";
import { DownloadQueueService } from "../application/services/download-queue.service.js";
import { SearchService } from "../application/services/search.service.js";
import { JobsService, type SchedulerService } from "../application/services/jobs.service.js";

// Clean Architecture - Controllers
import { PerformersController } from "../interfaces/controllers/performers.controller.js";
import { SubscriptionsController } from "../interfaces/controllers/subscriptions.controller.js";
import { QualityProfilesController } from "../interfaces/controllers/quality-profiles.controller.js";
import { SetupController } from "../interfaces/controllers/setup.controller.js";
import { LogsController } from "../interfaces/controllers/logs.controller.js";
import { AuthController } from "../interfaces/controllers/auth.controller.js";
import { TorrentsController } from "../interfaces/controllers/torrents.controller.js";
import { SettingsController } from "../interfaces/controllers/settings.controller.js";
import { DownloadQueueController } from "../interfaces/controllers/download-queue.controller.js";
import { SearchController } from "../interfaces/controllers/search.controller.js";
import { JobsController } from "../interfaces/controllers/jobs.controller.js";

export interface ContainerConfig {
  db: Database;
  logger: Logger;
  tpdb?: TPDBService;
  stashdb?: StashDBService;
  qbittorrent?: QBittorrentService;
  prowlarr?: ProwlarrService;
  scheduler?: SchedulerService;
}

/**
 * Create and configure the DI container with all services
 */
export function buildContainer(config: ContainerConfig) {
  const container = createContainer<ServiceContainer>({
    injectionMode: InjectionMode.PROXY,
  });

  // Register infrastructure dependencies
  container.register({
    db: asValue(config.db),
    logger: asValue(config.logger),
  });

  // Register core services
  container.register({
    settingsService: asClass(SettingsService).scoped(),
    logsService: asClass(LogsService).scoped(),
    jobProgressService: asClass(JobProgressService).scoped(),
  });

  // Register business logic services (old structure - will be migrated)
  container.register({
    subscriptionService: asClass(SubscriptionService).scoped(),
    torrentSearchService: asClass(TorrentSearchService).scoped(),
    downloadService: asClass(DownloadService).scoped(),
    parserService: asClass(TorrentParserService).scoped(),
    torrentCompletionService: asClass(TorrentCompletionService).scoped(),
    entityResolverService: asClass(EntityResolverService).scoped(),
    sceneMatcherService: asClass(SceneMatcher).scoped(),
    aiMatchingService: asClass(AIMatchingService).scoped(),
    crossEncoderService: asClass(CrossEncoderService).scoped(),
    speedProfileService: asClass(SpeedProfileService).scoped(),
  });

  // === Clean Architecture Layers ===

  // Register Repositories (Infrastructure Layer)
  container.register({
    performersRepository: asClass(PerformersRepository).scoped(),
    subscriptionsRepository: asClass(SubscriptionsRepository).scoped(),
    qualityProfilesRepository: asClass(QualityProfilesRepository).scoped(),
    setupRepository: asClass(SetupRepository).scoped(),
    logsRepository: asClass(LogsRepository).scoped(),
    authRepository: asClass(AuthRepository).scoped(),
    settingsRepository: asClass(SettingsRepository).scoped(),
    downloadQueueRepository: asClass(DownloadQueueRepository).scoped(),
    searchRepository: asClass(SearchRepository).scoped(),
    aiMatchScoresRepository: asClass(AIMatchScoresRepository).scoped(),
  });

  // Register Application Services (Business Logic Layer)
  container.register({
    performersService: asClass(PerformersService).scoped(),
    subscriptionsService: asClass(SubscriptionsService).scoped(),
    qualityProfilesService: asClass(QualityProfilesService).scoped(),
    setupService: asClass(SetupService).scoped(),
    newLogsService: asClass(NewLogsService).scoped(),
    authService: asClass(AuthService).scoped(),
    torrentsService: asClass(TorrentsService).scoped(),
    newSettingsService: asClass(NewSettingsService).scoped(),
    downloadQueueService: asClass(DownloadQueueService).scoped(),
    searchService: asClass(SearchService).scoped(),
    jobsService: asClass(JobsService).scoped(),
  });

  // Register Controllers (Interface Layer)
  container.register({
    performersController: asClass(PerformersController).scoped(),
    subscriptionsController: asClass(SubscriptionsController).scoped(),
    qualityProfilesController: asClass(QualityProfilesController).scoped(),
    setupController: asClass(SetupController).scoped(),
    logsController: asClass(LogsController).scoped(),
    authController: asClass(AuthController).scoped(),
    torrentsController: asClass(TorrentsController).scoped(),
    settingsController: asClass(SettingsController).scoped(),
    downloadQueueController: asClass(DownloadQueueController).scoped(),
    searchController: asClass(SearchController).scoped(),
    jobsController: asClass(JobsController).scoped(),
  });

  // Register external service clients (optional)
  if (config.tpdb) {
    container.register({
      tpdbService: asValue(config.tpdb),
      tpdb: asValue(config.tpdb), // Alias for legacy services
    });
  } else {
    container.register({
      tpdbService: asValue(undefined),
      tpdb: asValue(undefined),
    });
  }

  if (config.stashdb) {
    container.register({
      stashdbService: asValue(config.stashdb),
      stashdb: asValue(config.stashdb), // Alias for legacy services
    });
  } else {
    container.register({
      stashdbService: asValue(undefined),
      stashdb: asValue(undefined),
    });
  }

  if (config.qbittorrent) {
    container.register({
      qbittorrentService: asValue(config.qbittorrent),
      qbittorrent: asValue(config.qbittorrent), // Alias for legacy services
    });
  } else {
    // Register undefined for services that have optional qbittorrent dependency
    container.register({
      qbittorrentService: asValue(undefined),
      qbittorrent: asValue(undefined),
    });
  }

  if (config.prowlarr) {
    container.register({
      prowlarrService: asValue(config.prowlarr),
      prowlarr: asValue(config.prowlarr), // Alias for legacy services
    });
  } else {
    container.register({
      prowlarrService: asValue(undefined),
      prowlarr: asValue(undefined),
    });
  }

  if (config.scheduler) {
    container.register({
      scheduler: asValue(config.scheduler),
    });
  }

  return container;
}
