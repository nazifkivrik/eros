import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Database } from "@repo/database";
import { buildContainer } from "../container/index.js";
import type { ServiceContainer } from "../container/types.js";
import { FileManagerService } from "../application/services/file-management/file-manager.service.js";
import { SettingsRepository } from "../infrastructure/repositories/settings.repository.js";

import type { Logger } from "pino";

declare module "fastify" {
  interface FastifyInstance {
    container: ServiceContainer;
  }
}

/**
 * Container plugin
 * Builds the DI container and decorates the Fastify instance
 */
export default fp(async (app: FastifyInstance) => {
  // Load settings BEFORE building container (for services that need runtime config)
  // Use repository directly to avoid circular dependency with SettingsService
  const settingsRepository = new SettingsRepository({ db: app.db });
  const settingRecord = await settingsRepository.findByKey("app-settings");

  // Use default settings if none found
  const { DEFAULT_SETTINGS } = await import("@repo/shared-types");
  const settings = settingRecord
    ? (settingRecord.value as any)
    : DEFAULT_SETTINGS;

  // Build container with infrastructure dependencies and external service configs
  const container = buildContainer({
    db: app.db,
    logger: app.log as unknown as Logger,
    externalServices: {
      tpdb: app.tpdbConfig,
      stashdb: app.stashdbConfig,
      qbittorrent: app.qbittorrentConfig,
      prowlarr: app.prowlarrConfig,
    },
    scheduler: app.scheduler,
  });

  // Register services that need runtime configuration AFTER container creation
  // FileManagerService needs scenesPath and incompletePath from settings
  const fileManagerService = new FileManagerService({
    db: app.db,
    scenesPath: settings.general.scenesPath || "/app/media/scenes",
    incompletePath: settings.general.incompletePath || "/app/media/incomplete",
  });

  container.register({
    fileManagerService: { resolve: () => fileManagerService },
    fileManager: { resolve: () => fileManagerService }, // Alias for legacy services
  });

  // Decorate Fastify instance with container cradle wrapped in a plain object
  // This avoids Awilix Proxy issues with Fastify's decorate
  const containerCradle: Partial<ServiceContainer> = {
    // Infrastructure
    db: container.cradle.db,
    logger: container.cradle.logger,

    // Old services (will be migrated)
    settingsService: container.cradle.settingsService,
    logsService: container.cradle.logsService,
    jobProgressService: container.cradle.jobProgressService,
    torrentSearchService: container.cradle.torrentSearchService,
    fileManagerService: container.cradle.fileManagerService, // Runtime-configured service
    fileManager: container.cradle.fileManager, // Alias for legacy services
    downloadService: container.cradle.downloadService,
    parserService: container.cradle.parserService,
    torrentCompletionService: container.cradle.torrentCompletionService,
    entityResolverService: container.cradle.entityResolverService,
    sceneMatcherService: container.cradle.sceneMatcherService,
    aiMatchingService: container.cradle.aiMatchingService,
    crossEncoderService: container.cradle.crossEncoderService,
    speedProfileService: container.cradle.speedProfileService,

    // Clean Architecture - Repositories
    performersRepository: container.cradle.performersRepository,
    subscriptionsRepository: container.cradle.subscriptionsRepository,
    scenesRepository: container.cradle.scenesRepository,
    qualityProfilesRepository: container.cradle.qualityProfilesRepository,
    setupRepository: container.cradle.setupRepository,
    logsRepository: container.cradle.logsRepository,
    authRepository: container.cradle.authRepository,
    settingsRepository: container.cradle.settingsRepository,
    downloadQueueRepository: container.cradle.downloadQueueRepository,
    searchRepository: container.cradle.searchRepository,
    aiMatchScoresRepository: container.cradle.aiMatchScoresRepository,
    torrentsRepository: container.cradle.torrentsRepository,

    // Clean Architecture - Services
    performersService: container.cradle.performersService,
    subscriptionsService: container.cradle.subscriptionsService,
    subscriptionsCoreService: container.cradle.subscriptionsCoreService,
    subscriptionsScenesService: container.cradle.subscriptionsScenesService,
    subscriptionsDiscoveryService: container.cradle.subscriptionsDiscoveryService,
    subscriptionsManagementService: container.cradle.subscriptionsManagementService,
    subscriptionsTorrentService: container.cradle.subscriptionsTorrentService,
    qualityProfilesService: container.cradle.qualityProfilesService,
    setupService: container.cradle.setupService,
    logsService: container.cradle.logsService,
    authService: container.cradle.authService,
    torrentsService: container.cradle.torrentsService,
    settingsService: container.cradle.settingsService,
    downloadQueueService: container.cradle.downloadQueueService,
    searchService: container.cradle.searchService,
    jobsService: container.cradle.jobsService,

    // Clean Architecture - Controllers
    performersController: container.cradle.performersController,
    subscriptionsController: container.cradle.subscriptionsController,
    qualityProfilesController: container.cradle.qualityProfilesController,
    setupController: container.cradle.setupController,
    logsController: container.cradle.logsController,
    authController: container.cradle.authController,
    torrentsController: container.cradle.torrentsController,
    settingsController: container.cradle.settingsController,
    downloadQueueController: container.cradle.downloadQueueController,
    searchController: container.cradle.searchController,
    jobsController: container.cradle.jobsController,
    torrentSearchController: container.cradle.torrentSearchController,
  };

  // Add optional external services only if they are registered
  if (container.hasRegistration('scheduler')) {
    containerCradle.scheduler = container.cradle.scheduler;
  }
  // Always include adapters (will be undefined if none available)
  containerCradle.metadataProvider = container.cradle.metadataProvider;
  containerCradle.tpdbProvider = container.cradle.tpdbProvider;
  containerCradle.stashdbProvider = container.cradle.stashdbProvider;
  containerCradle.indexer = container.cradle.indexer;
  containerCradle.torrentClient = container.cradle.torrentClient;

  app.decorate("container", containerCradle as ServiceContainer);

  app.log.info("DI container initialized with all services");
});
