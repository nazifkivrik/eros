import { createContainer, asClass, asValue, InjectionMode } from 'awilix';
import { vi } from 'vitest';
import type { Database } from '@repo/database';
import type { Logger } from 'pino';
import type { ITorrentClient } from '@/infrastructure/adapters/interfaces/torrent-client.interface.js';
import type { IMetadataProvider } from '@/infrastructure/adapters/interfaces/metadata-provider.interface.js';
import type { IIndexer } from '@/infrastructure/adapters/interfaces/indexer.interface.js';

// Clean Architecture - Repositories
import { SubscriptionsRepository } from '@/infrastructure/repositories/subscriptions.repository.js';
import { DownloadQueueRepository } from '@/infrastructure/repositories/download-queue.repository.js';
import { QualityProfilesRepository } from '@/infrastructure/repositories/quality-profiles.repository.js';
import { PerformersRepository } from '@/infrastructure/repositories/performers.repository.js';
import { ScenesRepository } from '@/infrastructure/repositories/scenes.repository.js';
import { StudiosRepository } from '@/infrastructure/repositories/studios.repository.js';

// Clean Architecture - Application Services
import { SubscriptionsCoreService } from '@/application/services/subscriptions/subscriptions.core.service.js';
import { SubscriptionsDiscoveryService } from '@/application/services/subscriptions/subscriptions.discovery.service.js';
import { SubscriptionsTorrentService } from '@/application/services/subscriptions/subscriptions.torrent.service.js';
import { SubscriptionsScenesService } from '@/application/services/subscriptions/subscriptions.scenes.service.js';
import { SubscriptionsManagementService } from '@/application/services/subscriptions/subscriptions.management.service.js';
import { DownloadQueueService } from '@/application/services/download-queue.service.js';
import { TorrentSearchService } from '@/application/services/torrent-search/index.js';
import { DownloadService } from '@/application/services/torrent-selection/download.service.js';

export interface TestContainerConfig {
  db: Database;
  logger?: Logger;
  torrentClient?: ITorrentClient;
  metadataProvider?: IMetadataProvider;
  indexer?: IIndexer;
}

/**
 * Create a minimal DI container for testing
 * Only registers the services needed for the test
 */
export function createTestContainer(config: TestContainerConfig) {
  const container = createContainer({
    injectionMode: InjectionMode.PROXY,
  });

  // Register dependencies
  container.register({
    db: asValue(config.db),
    logger: asValue(config.logger || createMockLogger()),
  });

  // Register optional external services (for mocking)
  if (config.torrentClient) {
    container.register({
      torrentClient: asValue(config.torrentClient),
    });
  }
  if (config.metadataProvider) {
    container.register({
      metadataProvider: asValue(config.metadataProvider),
      tpdbProvider: asValue(config.metadataProvider),
    });
  }
  if (config.indexer) {
    container.register({
      indexer: asValue(config.indexer),
    });
  }

  // Register repositories
  container.register({
    subscriptionsRepository: asClass(SubscriptionsRepository).scoped(),
    downloadQueueRepository: asClass(DownloadQueueRepository).scoped(),
    qualityProfilesRepository: asClass(QualityProfilesRepository).scoped(),
    performersRepository: asClass(PerformersRepository).scoped(),
    scenesRepository: asClass(ScenesRepository).scoped(),
    studiosRepository: asClass(StudiosRepository).scoped(),
  });

  // Register application services
  container.register({
    subscriptionsCoreService: asClass(SubscriptionsCoreService).scoped(),
    subscriptionsDiscoveryService: asClass(SubscriptionsDiscoveryService).scoped(),
    subscriptionsTorrentService: asClass(SubscriptionsTorrentService).scoped(),
    subscriptionsScenesService: asClass(SubscriptionsScenesService).scoped(),
    subscriptionsManagementService: asClass(SubscriptionsManagementService).scoped(),
    downloadQueueService: asClass(DownloadQueueService).scoped(),
    torrentSearchService: asClass(TorrentSearchService).scoped(),
    downloadService: asClass(DownloadService).scoped(),
  });

  return container;
}

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    silent: vi.fn(),
  } as unknown as Logger;
}
