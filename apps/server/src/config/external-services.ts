/**
 * External Services Configuration Manager
 * Manages configuration for external service integrations with dynamic reload capability
 * Updated to support multi-provider architecture with registries
 */

import type { Logger } from "pino";
import type { Database } from "@repo/database";
import { SettingsRepository } from "../infrastructure/repositories/settings.repository.js";
import type { AppSettings, ProvidersConfig, MetadataProviderConfig, IndexerProviderConfig, TorrentClientConfig } from "@repo/shared-types";
import { DEFAULT_SETTINGS } from "@repo/shared-types";
import { EventEmitter } from "events";
import {
  MetadataProviderRegistry,
  IndexerRegistry,
  TorrentClientRegistry,
} from "../infrastructure/registries/provider-registry.js";
import type { IMetadataProvider } from "../infrastructure/adapters/interfaces/metadata-provider.interface.js";
import type { IIndexer } from "../infrastructure/adapters/interfaces/indexer.interface.js";
import type { ITorrentClient } from "../infrastructure/adapters/interfaces/torrent-client.interface.js";
import { createTPDBAdapter } from "../infrastructure/adapters/tpdb.adapter.js";
import { createStashDBAdapter } from "../infrastructure/adapters/stashdb.adapter.js";
import { createProwlarrAdapter } from "../infrastructure/adapters/prowlarr.adapter.js";
import { createQBittorrentAdapter } from "../infrastructure/adapters/qbittorrent.adapter.js";

/**
 * External Services Manager
 * Loads external service configs from database and provides reload capability
 * Now uses provider registries for multi-provider support
 */
export class ExternalServicesManager extends EventEmitter {
  private db: Database;
  private logger: Logger;
  private metadataRegistry: MetadataProviderRegistry;
  private indexerRegistry: IndexerRegistry;
  private torrentClientRegistry: TorrentClientRegistry;
  private initialized = false;

  // Legacy config for backward compatibility (deprecated)
  private legacyConfig = {
    tpdb: { apiUrl: "", apiKey: "" },
    stashdb: { apiUrl: "", apiKey: "" },
    qbittorrent: { url: "", username: "", password: "" },
    prowlarr: { baseUrl: "", apiKey: "" },
  };

  constructor(db: Database, logger: Logger) {
    super();
    this.db = db;
    this.logger = logger;

    // Initialize registries
    this.metadataRegistry = new MetadataProviderRegistry(logger);
    this.indexerRegistry = new IndexerRegistry(logger);
    this.torrentClientRegistry = new TorrentClientRegistry(logger);
  }

  /**
   * Initialize the manager by loading configs from database
   * Runs migration if needed
   */
  async initialize(): Promise<void> {
    const settingsRepository = new SettingsRepository({ db: this.db, logger: this.logger });

    // Check if migration is needed
    const needsMigration = await settingsRepository.needsProviderMigration();
    if (needsMigration) {
      this.logger.info("Provider migration needed, running migration...");
      await settingsRepository.migrateProviders();
      this.logger.info("Provider migration completed");
    }

    await this.reload();
    this.initialized = true;
  }

  /**
   * Reload all external service configs from database
   * Emits 'config:updated' event with new config
   * Now uses provider registries
   */
  async reload(): Promise<void> {
    const settingsRepository = new SettingsRepository({ db: this.db, logger: this.logger });
    const settingRecord = await settingsRepository.findByKey("app-settings");

    // Use default settings if none found
    const settings: AppSettings = settingRecord
      ? (settingRecord.value as AppSettings)
      : DEFAULT_SETTINGS;

    const providers = settings.providers || { metadata: [], indexers: [], torrentClients: [] };

    // Clear existing registries
    this.metadataRegistry = new MetadataProviderRegistry(this.logger);
    this.indexerRegistry = new IndexerRegistry(this.logger);
    this.torrentClientRegistry = new TorrentClientRegistry(this.logger);

    // Register metadata providers
    for (const provider of providers.metadata) {
      if (!provider.enabled) continue;

      const adapter = this.createMetadataAdapter(provider);
      if (adapter) {
        this.metadataRegistry.register(provider.id, adapter);
      }
    }

    // Register indexers
    for (const provider of providers.indexers) {
      if (!provider.enabled) continue;

      const adapter = this.createIndexerAdapter(provider);
      if (adapter) {
        this.indexerRegistry.register(provider.id, adapter);
      }
    }

    // Register torrent clients
    for (const provider of providers.torrentClients) {
      if (!provider.enabled) continue;

      const adapter = this.createTorrentClientAdapter(provider);
      if (adapter) {
        this.torrentClientRegistry.register(provider.id, adapter);
      }
    }

    // Update legacy config for backward compatibility
    this.updateLegacyConfig(settings, providers);

    this.logger.info({
      metadataCount: this.metadataRegistry.getAll().length,
      indexerCount: this.indexerRegistry.getAll().length,
      torrentClientCount: this.torrentClientRegistry.getAll().length,
    }, "External services reloaded");

    this.emit("config:updated", {
      providers,
      legacy: this.legacyConfig,
    });
  }

  /**
   * Create metadata adapter based on provider type
   */
  private createMetadataAdapter(provider: MetadataProviderConfig): IMetadataProvider | null {
    try {
      switch (provider.type) {
        case "tpdb":
          return createTPDBAdapter(
            { apiUrl: provider.apiUrl, apiKey: provider.apiKey },
            this.logger
          );
        case "stashdb":
          return createStashDBAdapter(
            { apiUrl: provider.apiUrl, apiKey: provider.apiKey },
            this.logger
          );
        default:
          this.logger.warn({ type: provider.type }, "Unknown metadata provider type");
          return null;
      }
    } catch (error) {
      this.logger.error({ error, provider }, "Failed to create metadata adapter");
      return null;
    }
  }

  /**
   * Create indexer adapter based on provider type
   */
  private createIndexerAdapter(provider: IndexerProviderConfig): IIndexer | null {
    try {
      switch (provider.type) {
        case "prowlarr":
          return createProwlarrAdapter(
            { baseUrl: provider.baseUrl, apiKey: provider.apiKey },
            this.logger
          );
        // Future: jackett, etc.
        default:
          this.logger.warn({ type: provider.type }, "Unknown indexer provider type");
          return null;
      }
    } catch (error) {
      this.logger.error({ error, provider }, "Failed to create indexer adapter");
      return null;
    }
  }

  /**
   * Create torrent client adapter based on provider type
   */
  private createTorrentClientAdapter(provider: TorrentClientConfig): ITorrentClient | null {
    try {
      switch (provider.type) {
        case "qbittorrent":
          return createQBittorrentAdapter(
            { url: provider.url, username: provider.username, password: provider.password },
            this.logger
          );
        // Future: transmission, deluge, etc.
        default:
          this.logger.warn({ type: provider.type }, "Unknown torrent client type");
          return null;
      }
    } catch (error) {
      this.logger.error({ error, provider }, "Failed to create torrent client adapter");
      return null;
    }
  }

  /**
   * Update legacy config for backward compatibility
   * Uses first enabled provider of each type
   */
  private updateLegacyConfig(settings: AppSettings, providers: ProvidersConfig): void {
    // Metadata providers
    const firstMetadata = providers.metadata.find(p => p.enabled);
    if (firstMetadata) {
      this.legacyConfig.tpdb = firstMetadata.type === "tpdb"
        ? { apiUrl: firstMetadata.apiUrl, apiKey: firstMetadata.apiKey }
        : { apiUrl: "", apiKey: "" };

      this.legacyConfig.stashdb = firstMetadata.type === "stashdb"
        ? { apiUrl: firstMetadata.apiUrl, apiKey: firstMetadata.apiKey }
        : { apiUrl: "", apiKey: "" };
    }

    // Indexer
    const firstIndexer = providers.indexers.find(p => p.enabled);
    if (firstIndexer) {
      this.legacyConfig.prowlarr = {
        baseUrl: firstIndexer.baseUrl,
        apiKey: firstIndexer.apiKey,
      };
    }

    // Torrent client
    const firstTorrentClient = providers.torrentClients.find(p => p.enabled);
    if (firstTorrentClient) {
      this.legacyConfig.qbittorrent = {
        url: firstTorrentClient.url,
        username: firstTorrentClient.username,
        password: firstTorrentClient.password,
      };
    }
  }

  /**
   * Get metadata provider registry
   */
  getMetadataRegistry(): MetadataProviderRegistry {
    return this.metadataRegistry;
  }

  /**
   * Get indexer registry
   */
  getIndexerRegistry(): IndexerRegistry {
    return this.indexerRegistry;
  }

  /**
   * Get torrent client registry
   */
  getTorrentClientRegistry(): TorrentClientRegistry {
    return this.torrentClientRegistry;
  }

  /**
   * Get current legacy config (deprecated, for backward compatibility)
   */
  getConfig() {
    return {
      providers: {
        metadata: this.metadataRegistry.getAll(),
        indexers: this.indexerRegistry.getAll(),
        torrentClients: this.torrentClientRegistry.getAll(),
      },
      legacy: this.legacyConfig,
    };
  }

  /**
   * Check if manager has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Event types for ExternalServicesManager
 */
export interface ExternalServicesEvents {
  configUpdated: [{
    providers: {
      metadata: Array<{ id: string; provider: IMetadataProvider }>;
      indexers: Array<{ id: string; provider: IIndexer }>;
      torrentClients: Array<{ id: string; provider: ITorrentClient }>;
    };
    legacy: {
      tpdb: { apiUrl: string; apiKey: string };
      stashdb: { apiUrl: string; apiKey: string };
      qbittorrent: { url: string; username: string; password: string };
      prowlarr: { baseUrl: string; apiKey: string };
    };
  }];
}
