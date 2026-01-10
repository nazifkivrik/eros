import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Database } from "@repo/database";
import { buildContainer } from "../container/index.js";
import type { ServiceContainer } from "../container/types.js";
import { SettingsService } from "../services/settings.service.js";
import { FileManagerService } from "../services/file-manager.service.js";

import type { Logger } from "pino";
import type { TPDBService } from "../services/tpdb/tpdb.service.js";
import type { StashDBService } from "../services/stashdb.service.js";
import type { QBittorrentService } from "../services/qbittorrent.service.js";
import type { ProwlarrService } from "../services/prowlarr.service.js";

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
  const tempSettingsService = new SettingsService({ db: app.db });
  const settings = await tempSettingsService.getSettings();

  // Build container with infrastructure dependencies
  const container = buildContainer({
    db: app.db,
    logger: app.log as unknown as Logger,
    tpdb: app.tpdb,
    stashdb: app.stashdb,
    // Use type assertion if global types are not picked up
    qbittorrent: (app.qbittorrent as QBittorrentService | null) ?? undefined,
    prowlarr: app.prowlarr as ProwlarrService | undefined,
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
    subscriptionService: container.cradle.subscriptionService,
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
    qualityProfilesRepository: container.cradle.qualityProfilesRepository,
    setupRepository: container.cradle.setupRepository,
    logsRepository: container.cradle.logsRepository,
    authRepository: container.cradle.authRepository,
    settingsRepository: container.cradle.settingsRepository,
    downloadQueueRepository: container.cradle.downloadQueueRepository,
    searchRepository: container.cradle.searchRepository,
    aiMatchScoresRepository: container.cradle.aiMatchScoresRepository,

    // Clean Architecture - Services
    performersService: container.cradle.performersService,
    subscriptionsService: container.cradle.subscriptionsService,
    qualityProfilesService: container.cradle.qualityProfilesService,
    setupService: container.cradle.setupService,
    newLogsService: container.cradle.newLogsService,
    authService: container.cradle.authService,
    torrentsService: container.cradle.torrentsService,
    newSettingsService: container.cradle.newSettingsService,
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
  };

  // Add optional external services only if they are registered
  if (container.hasRegistration('tpdbService')) {
    containerCradle.tpdbService = container.cradle.tpdbService;
  }
  if (container.hasRegistration('stashdbService')) {
    containerCradle.stashdbService = container.cradle.stashdbService;
  }
  if (container.hasRegistration('qbittorrentService')) {
    containerCradle.qbittorrentService = container.cradle.qbittorrentService;
  }
  if (container.hasRegistration('prowlarrService')) {
    containerCradle.prowlarrService = container.cradle.prowlarrService;
  }
  if (container.hasRegistration('scheduler')) {
    containerCradle.scheduler = container.cradle.scheduler;
  }

  app.decorate("container", containerCradle as ServiceContainer);

  app.log.info("DI container initialized with all services");
});
