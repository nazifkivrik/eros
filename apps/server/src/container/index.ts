import { createContainer, asClass, asValue, asFunction, InjectionMode } from "awilix";
import type { Database } from "@repo/database";
import type { Logger } from "pino";
import type { ServiceContainer } from "./types.js";
import type { ExternalServicesManager } from "../config/external-services.js";
import { JobProgressService } from "../infrastructure/job-progress.service.js";
import { getJobProgressService } from "../infrastructure/job-progress.service.js";
import { TorrentSearchService } from "../application/services/torrent-search/index.js";
import { DownloadService } from "../application/services/torrent-selection/download.service.js";
// FileManagerService is registered in plugin with runtime config
import { TorrentParserService } from "../application/services/torrent-quality/parser.service.js";
import { EntityResolverService } from "../application/services/entity-resolver/entity-resolver.service.js";
import { SceneMatcher } from "../application/services/matching/scene-matcher.service.js";
import { AIMatchingService } from "../application/services/ai-matching/ai-matching.service.js";
import { CrossEncoderService } from "../application/services/ai-matching/cross-encoder.service.js";
import { SpeedProfileService, createSpeedProfileService } from "../application/services/speed-profile.service.js";

// Adapters (now self-contained, no longer wrap old services)
import { createProwlarrAdapter } from "../infrastructure/adapters/prowlarr.adapter.js";
import { createQBittorrentAdapter } from "../infrastructure/adapters/qbittorrent.adapter.js";
import { createTPDBAdapter } from "../infrastructure/adapters/tpdb.adapter.js";
import { createStashDBAdapter } from "../infrastructure/adapters/stashdb.adapter.js";
import type { IIndexer } from "../infrastructure/adapters/interfaces/indexer.interface.js";
import type { ITorrentClient } from "../infrastructure/adapters/interfaces/torrent-client.interface.js";
import type { IMetadataProvider } from "../infrastructure/adapters/interfaces/metadata-provider.interface.js";

// Clean Architecture - Repositories
import { PerformersRepository } from "../infrastructure/repositories/performers.repository.js";
import { SubscriptionsRepository } from "../infrastructure/repositories/subscriptions.repository.js";
import { ScenesRepository } from "../infrastructure/repositories/scenes.repository.js";
import { QualityProfilesRepository } from "../infrastructure/repositories/quality-profiles.repository.js";
import { SetupRepository } from "../infrastructure/repositories/setup.repository.js";
import { LogsRepository } from "../infrastructure/repositories/logs.repository.js";
import { AuthRepository } from "../infrastructure/repositories/auth.repository.js";
import { SettingsRepository } from "../infrastructure/repositories/settings.repository.js";
import { DownloadQueueRepository } from "../infrastructure/repositories/download-queue.repository.js";
import { SearchRepository } from "../infrastructure/repositories/search.repository.js";
import { AIMatchScoresRepository } from "../infrastructure/repositories/ai-match-scores.repository.js";
import { TorrentsRepository } from "../infrastructure/repositories/torrents.repository.js";
import { JobsLogRepository } from "../infrastructure/repositories/jobs.repository.js";
import { StudiosRepository } from "../infrastructure/repositories/studios.repository.js";

// Clean Architecture - Application Services
import { PerformersService } from "../application/services/performers.service.js";
import { SubscriptionsService } from "../application/services/subscriptions.service.js";
import { SubscriptionsCoreService } from "../application/services/subscriptions/subscriptions.core.service.js";
import { SubscriptionsScenesService } from "../application/services/subscriptions/subscriptions.scenes.service.js";
import { SubscriptionsDiscoveryService } from "../application/services/subscriptions/subscriptions.discovery.service.js";
import { SubscriptionsManagementService } from "../application/services/subscriptions/subscriptions.management.service.js";
import { SubscriptionsTorrentService } from "../application/services/subscriptions/subscriptions.torrent.service.js";
import { QualityProfilesService } from "../application/services/quality-profiles.service.js";
import { SetupService } from "../application/services/setup.service.js";
import { LogsService } from "../application/services/logs.service.js";
import { AuthService } from "../application/services/auth.service.js";
import { TorrentsService } from "../application/services/torrents.service.js";
import { SettingsService as NewSettingsService } from "../application/services/settings.service.js";
import { DownloadQueueService } from "../application/services/download-queue.service.js";
import { SearchService } from "../application/services/search.service.js";
import { JobsService } from "../application/services/jobs.service.js";
import { SchedulerService } from "../application/services/scheduler.service.js";
import { TorrentCompletionHandlerService } from "../application/services/torrent-completion/torrent-completion.handler.service.js";
import { DashboardService } from "../application/services/dashboard.service.js";

// Clean Architecture - Jobs
import { CleanupJob } from "../application/jobs/cleanup.job.js";
import { SubscriptionSearchJob } from "../application/jobs/subscription-search.job.js";
import { TorrentMonitorJob } from "../application/jobs/torrent-monitor.job.js";
import { MetadataRefreshJob } from "../application/jobs/metadata-refresh.job.js";

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
import { TorrentSearchController } from "../interfaces/controllers/torrent-search.controller.js";
import { DashboardController } from "../interfaces/controllers/dashboard.controller.js";

/**
 * Configuration for external service integrations
 */
export interface ExternalServiceConfig {
  // Prowlarr indexer config
  prowlarr?: {
    baseUrl: string;
    apiKey: string;
  };
  // qBittorrent client config
  qbittorrent?: {
    url: string;
    username: string;
    password: string;
  };
  // ThePornDB config
  tpdb?: {
    apiUrl: string;
    apiKey: string;
  };
  // StashDB config
  stashdb?: {
    apiUrl: string;
    apiKey?: string;
  };
}

export interface ContainerConfig {
  db: Database;
  logger: Logger;
  externalServices?: ExternalServiceConfig;
  externalServicesManager?: ExternalServicesManager;
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
    ...(config.externalServicesManager
      ? { externalServicesManager: asValue(config.externalServicesManager) }
      : {}),
  });

  // Register core services
  container.register({
    jobProgressService: asValue(getJobProgressService()),
  });

  // Register core business logic services
  container.register({
    downloadService: asClass(DownloadService).scoped(),
    parserService: asClass(TorrentParserService).scoped(),
    entityResolverService: asClass(EntityResolverService).scoped(),
    sceneMatcherService: asClass(SceneMatcher).scoped(),
    aiMatchingService: asClass(AIMatchingService).scoped(),
    crossEncoderService: asClass(CrossEncoderService).scoped(),
    speedProfileService: asValue(createSpeedProfileService()),
  });

  // === Clean Architecture Layers ===

  // Register Repositories (Infrastructure Layer)
  container.register({
    performersRepository: asClass(PerformersRepository).scoped(),
    subscriptionsRepository: asClass(SubscriptionsRepository).scoped(),
    scenesRepository: asClass(ScenesRepository).scoped(),
    qualityProfilesRepository: asClass(QualityProfilesRepository).scoped(),
    setupRepository: asClass(SetupRepository).scoped(),
    logsRepository: asClass(LogsRepository).scoped(),
    authRepository: asClass(AuthRepository).scoped(),
    settingsRepository: asClass(SettingsRepository).scoped(),
    downloadQueueRepository: asClass(DownloadQueueRepository).scoped(),
    searchRepository: asClass(SearchRepository).scoped(),
    aiMatchScoresRepository: asClass(AIMatchScoresRepository).scoped(),
    torrentsRepository: asClass(TorrentsRepository).scoped(),
    jobsRepository: asClass(JobsLogRepository).scoped(),
    studiosRepository: asClass(StudiosRepository).scoped(),
  });

  // Register Application Services (Business Logic Layer)
  container.register({
    performersService: asClass(PerformersService).scoped(),
    torrentSearchService: asClass(TorrentSearchService).scoped(),
    subscriptionsService: asClass(SubscriptionsService).scoped(),
    subscriptionsCoreService: asClass(SubscriptionsCoreService).scoped(),
    subscriptionsScenesService: asClass(SubscriptionsScenesService).scoped(),
    subscriptionsDiscoveryService: asClass(SubscriptionsDiscoveryService).scoped(),
    subscriptionsManagementService: asClass(SubscriptionsManagementService).scoped(),
    subscriptionsTorrentService: asClass(SubscriptionsTorrentService).scoped(),
    qualityProfilesService: asClass(QualityProfilesService).scoped(),
    setupService: asClass(SetupService).scoped(),
    logsService: asClass(LogsService).scoped(),
    authService: asClass(AuthService).scoped(),
    torrentsService: asClass(TorrentsService).scoped(),
    settingsService: asClass(NewSettingsService).scoped(),
    downloadQueueService: asClass(DownloadQueueService).scoped(),
    searchService: asClass(SearchService).scoped(),
    jobsService: asClass(JobsService).scoped(),
    schedulerService: asClass(SchedulerService).scoped(),
    torrentCompletionService: asClass(TorrentCompletionHandlerService).scoped(),
    dashboardService: asClass(DashboardService).scoped(),
  });

  // Register Jobs
  container.register({
    cleanupJob: asClass(CleanupJob).scoped(),
    subscriptionSearchJob: asClass(SubscriptionSearchJob).scoped(),
    torrentMonitorJob: asClass(TorrentMonitorJob).scoped(),
    metadataRefreshJob: asClass(MetadataRefreshJob).scoped(),
  });

  // Register Controllers (Interface Layer)
  container.register({
    performersController: asClass(PerformersController).scoped(),
    torrentSearchController: asClass(TorrentSearchController).scoped(),
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
    dashboardController: asClass(DashboardController).scoped(),
  });

  // === External Service Adapters ===

  const ext = config.externalServices || {};
  const logger = config.logger;

  // Prowlarr adapter (indexer)
  if (ext.prowlarr) {
    const prowlarrAdapter = createProwlarrAdapter(ext.prowlarr, logger);
    container.register({
      indexer: asValue(prowlarrAdapter as IIndexer),
    });
  } else {
    container.register({
      indexer: asValue(undefined),
    });
  }

  // qBittorrent adapter (torrent client)
  if (ext.qbittorrent) {
    const qbittorrentAdapter = createQBittorrentAdapter(ext.qbittorrent, logger);
    container.register({
      torrentClient: asValue(qbittorrentAdapter as ITorrentClient),
    });
  } else {
    container.register({
      torrentClient: asValue(undefined),
    });
  }

  // ThePornDB adapter (metadata provider)
  if (ext.tpdb) {
    const tpdbAdapter = createTPDBAdapter(ext.tpdb, logger);
    container.register({
      tpdbProvider: asValue(tpdbAdapter as IMetadataProvider),
    });
  } else {
    container.register({
      tpdbProvider: asValue(undefined),
    });
  }

  // StashDB adapter (metadata provider)
  if (ext.stashdb) {
    const stashdbAdapter = createStashDBAdapter(ext.stashdb, logger);
    container.register({
      stashdbProvider: asValue(stashdbAdapter as unknown as IMetadataProvider),
    });
  } else {
    container.register({
      stashdbProvider: asValue(undefined),
    });
  }

  // Register generic metadataProvider that picks the first available provider
  // Priority: TPDB > StashDB
  const metadataProvider = ext.tpdb
    ? createTPDBAdapter(ext.tpdb, logger)
    : ext.stashdb
    ? createStashDBAdapter(ext.stashdb, logger)
    : undefined;

  container.register({
    metadataProvider: asValue(metadataProvider as IMetadataProvider | undefined),
  });

  return container;
}
