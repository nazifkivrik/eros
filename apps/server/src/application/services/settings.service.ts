import type { Logger } from "pino";
import { DEFAULT_SETTINGS, type AppSettings } from "@repo/shared-types";
import { SettingsRepository } from "@/infrastructure/repositories/settings.repository.js";
import type { ITorrentClient } from "@/infrastructure/adapters/interfaces/torrent-client.interface.js";
import type { MetadataProviderRegistry, IndexerRegistry, TorrentClientRegistry } from "@/infrastructure/registries/provider-registry.js";

/**
 * DTOs for Settings Service
 */
export interface TestConnectionDTO {
  service: "stashdb" | "tpdb" | "prowlarr" | "qbittorrent";
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
}

export interface QBittorrentStatusDTO {
  connected: boolean;
  torrentsCount?: number;
  downloadSpeed?: number;
  uploadSpeed?: number;
  error?: string;
}

/**
 * Settings Service (Clean Architecture)
 * Business logic for application settings management
 * Handles: Settings CRUD, connection testing, plugin reloading
 */
export class SettingsService {
  private settingsRepository: SettingsRepository;
  private logger: Logger;
  private metadataRegistry: MetadataProviderRegistry;
  private indexerRegistry: IndexerRegistry;
  private torrentClientRegistry: TorrentClientRegistry;

  constructor({
    settingsRepository,
    logger,
    metadataRegistry,
    indexerRegistry,
    torrentClientRegistry,
  }: {
    settingsRepository: SettingsRepository;
    logger: Logger;
    metadataRegistry: MetadataProviderRegistry;
    indexerRegistry: IndexerRegistry;
    torrentClientRegistry: TorrentClientRegistry;
  }) {
    this.settingsRepository = settingsRepository;
    this.logger = logger;
    this.metadataRegistry = metadataRegistry;
    this.indexerRegistry = indexerRegistry;
    this.torrentClientRegistry = torrentClientRegistry;
  }

  /**
   * Get all application settings
   * Business logic: Deep merge with defaults to ensure all required fields exist
   */
  async getSettings(): Promise<AppSettings> {
    this.logger.debug("Fetching application settings");

    const setting = await this.settingsRepository.findByKey("app-settings");

    if (setting) {
      // Deep merge saved settings over DEFAULT_SETTINGS
      const savedSettings = setting.value as Partial<AppSettings>;

      return {
        general: {
          ...DEFAULT_SETTINGS.general,
          ...(savedSettings.general || {}),
        },
        fileManagement: {
          ...DEFAULT_SETTINGS.fileManagement,
          ...(savedSettings.fileManagement || {}),
        },
        stashdb: {
          ...DEFAULT_SETTINGS.stashdb,
          ...(savedSettings.stashdb || {}),
        },
        tpdb: {
          ...DEFAULT_SETTINGS.tpdb,
          ...(savedSettings.tpdb || {}),
        },
        prowlarr: {
          ...DEFAULT_SETTINGS.prowlarr,
          ...(savedSettings.prowlarr || {}),
          // Auto-remove trailing slash from apiUrl to prevent double slashes
          ...(savedSettings.prowlarr?.apiUrl && {
            apiUrl: savedSettings.prowlarr.apiUrl.replace(/\/$/, '')
          }),
        },
        qbittorrent: {
          ...DEFAULT_SETTINGS.qbittorrent,
          ...(savedSettings.qbittorrent || {}),
          // Auto-remove trailing slash from url to prevent double slashes
          ...(savedSettings.qbittorrent?.url && {
            url: savedSettings.qbittorrent.url.replace(/\/$/, '')
          }),
        },
        ai: {
          ...DEFAULT_SETTINGS.ai,
          ...(savedSettings.ai || {}),
        },
        jobs: {
          subscriptionSearch: {
            ...DEFAULT_SETTINGS.jobs.subscriptionSearch,
            ...(savedSettings.jobs?.subscriptionSearch || {}),
          },
          metadataRefresh: {
            ...DEFAULT_SETTINGS.jobs.metadataRefresh,
            ...(savedSettings.jobs?.metadataRefresh || {}),
          },
          torrentMonitor: {
            ...DEFAULT_SETTINGS.jobs.torrentMonitor,
            ...(savedSettings.jobs?.torrentMonitor || {}),
          },
          cleanup: {
            ...DEFAULT_SETTINGS.jobs.cleanup,
            ...(savedSettings.jobs?.cleanup || {}),
          },
          metadataDiscovery: {
            ...DEFAULT_SETTINGS.jobs.metadataDiscovery,
            ...(savedSettings.jobs?.metadataDiscovery || {}),
          },
          missingScenesSearch: {
            ...DEFAULT_SETTINGS.jobs.missingScenesSearch,
            ...(savedSettings.jobs?.missingScenesSearch || {}),
          },
          unifiedSync: {
            ...DEFAULT_SETTINGS.jobs.unifiedSync,
            ...(savedSettings.jobs?.unifiedSync || {}),
          },
          qbittorrentCleanup: {
            ...DEFAULT_SETTINGS.jobs.qbittorrentCleanup,
            ...(savedSettings.jobs?.qbittorrentCleanup || {}),
          },
        },
        speedSchedule: {
          ...DEFAULT_SETTINGS.speedSchedule,
          ...(savedSettings.speedSchedule || {}),
        },
        downloadPaths: {
          ...DEFAULT_SETTINGS.downloadPaths,
          ...(savedSettings.downloadPaths || {}),
        },
        providers: {
          ...DEFAULT_SETTINGS.providers,
          ...(savedSettings.providers || {}),
        },
      };
    }

    this.logger.info("No settings found, returning defaults");
    return DEFAULT_SETTINGS;
  }

  /**
   * Update application settings
   * Business logic: Persist settings and return updated values
   */
  async updateSettings(settings: AppSettings): Promise<AppSettings> {
    this.logger.info("Updating application settings");

    await this.settingsRepository.upsert("app-settings", settings);

    this.logger.info("Settings updated successfully");
    return settings;
  }

  /**
   * Test connection to an external service
   * Business rule: Validate configuration before testing, use configured adapters
   */
  async testConnection(dto: TestConnectionDTO): Promise<TestConnectionResult> {
    this.logger.info({ service: dto.service, serviceType: typeof dto.service }, "Testing service connection");

    try {
      switch (dto.service) {
        case "stashdb":
          return await this.testStashDBConnectionAdapter();
        case "tpdb":
          return await this.testTPDBConnectionAdapter();
        case "prowlarr":
          return await this.testProwlarrConnectionAdapter();
        case "qbittorrent":
          return await this.testQBittorrentConnectionAdapter();
        default:
          this.logger.warn({ service: dto.service, receivedType: typeof dto.service }, "Unknown service in switch");
          return { success: false, message: "Unknown service" };
      }
    } catch (error) {
      this.logger.error({ service: dto.service, error }, "Connection test failed");
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Test TPDB connection with provided credentials (creates temporary adapter)
   * Business logic: Test connection without saving to settings
   */
  async testTPDBConnectionPublic(apiUrl: string, apiKey: string): Promise<boolean> {
    this.logger.info("Testing TPDB connection (public)");

    try {
      // Create adapter instance for testing
      const { createTPDBAdapter } = await import("@/infrastructure/adapters/tpdb.adapter.js");
      const adapter = createTPDBAdapter({ apiUrl, apiKey }, this.logger);
      const result = await adapter.testConnection();

      this.logger.info({ success: result }, "TPDB connection test result");
      return result;
    } catch (error) {
      this.logger.error({ error }, "TPDB connection test failed");
      return false;
    }
  }

  /**
   * Test StashDB connection with provided credentials (creates temporary adapter)
   * Business logic: Test connection without saving to settings
   */
  async testStashDBConnectionPublic(apiUrl: string, apiKey: string): Promise<boolean> {
    this.logger.info("Testing StashDB connection (public)");

    try {
      // Create adapter instance for testing
      const { createStashDBAdapter } = await import("@/infrastructure/adapters/stashdb.adapter.js");
      const adapter = createStashDBAdapter({ apiUrl, apiKey }, this.logger);
      const result = await adapter.testConnection();

      this.logger.info({ success: result }, "StashDB connection test result");
      return result;
    } catch (error) {
      this.logger.error({ error }, "StashDB connection test failed");
      return false;
    }
  }

  /**
   * Test qBittorrent connection with provided credentials (creates temporary adapter)
   * Business logic: Test connection without saving to settings
   */
  async testQBittorrentConnectionPublic(url: string, username: string, password: string): Promise<boolean> {
    this.logger.info("Testing qBittorrent connection (public)");

    try {
      // Create adapter instance for testing
      const { createQBittorrentAdapter } = await import("@/infrastructure/adapters/qbittorrent.adapter.js");
      const adapter = createQBittorrentAdapter({ url, username, password }, this.logger);
      const result = await adapter.testConnection();

      this.logger.info({ success: result }, "qBittorrent connection test result");
      return result;
    } catch (error) {
      this.logger.error({ error }, "qBittorrent connection test failed");
      return false;
    }
  }

  /**
   * Test Prowlarr connection with provided credentials (creates temporary adapter)
   * Business logic: Test connection without saving to settings
   */
  async testProwlarrConnectionPublic(apiUrl: string, apiKey: string): Promise<boolean> {
    this.logger.info("Testing Prowlarr connection (public)");

    try {
      // Create adapter instance for testing
      const { createProwlarrAdapter } = await import("@/infrastructure/adapters/prowlarr.adapter.js");
      const adapter = createProwlarrAdapter({ baseUrl: apiUrl, apiKey }, this.logger);
      const result = await adapter.testConnection();

      this.logger.info({ success: result }, "Prowlarr connection test result");
      return result;
    } catch (error) {
      this.logger.error({ error }, "Prowlarr connection test failed");
      return false;
    }
  }

  /**
   * Get qBittorrent status using configured adapter
   * Business logic: Check connection and retrieve stats
   */
  async getQBittorrentStatus(): Promise<QBittorrentStatusDTO> {
    this.logger.debug("Fetching qBittorrent status");

    const primaryTorrentClient = this.torrentClientRegistry.getPrimary();

    if (!primaryTorrentClient) {
      return {
        connected: false,
        error: "Torrent client not configured",
      };
    }

    try {
      const torrents = await primaryTorrentClient.provider.getTorrents();
      const downloadSpeed = torrents.reduce((sum: number, t: any) => sum + (t.downloadSpeed || 0), 0);
      const uploadSpeed = torrents.reduce((sum: number, t: any) => sum + (t.uploadSpeed || 0), 0);

      this.logger.info(
        { torrentsCount: torrents.length, downloadSpeed, uploadSpeed },
        "qBittorrent status retrieved"
      );

      return {
        connected: true,
        torrentsCount: torrents.length,
        downloadSpeed,
        uploadSpeed,
      };
    } catch (error) {
      this.logger.error({ error }, "Failed to get qBittorrent status");
      return {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Test TPDB connection using configured adapter
   * Business rule: Validate API URL and key before testing
   */
  private async testTPDBConnectionAdapter(): Promise<TestConnectionResult> {
    const providers = this.metadataRegistry.getAll().filter(p => p.id.includes('tpdb'));

    if (providers.length === 0) {
      return { success: false, message: "TPDB provider not configured" };
    }

    const provider = providers[0].provider;
    const isConnected = await provider.testConnection();

    if (isConnected) {
      return { success: true, message: "Connected to TPDB successfully" };
    } else {
      return { success: false, message: "Failed to connect to TPDB" };
    }
  }

  /**
   * Test StashDB connection using configured adapter
   * Business rule: Validate API URL before testing
   */
  private async testStashDBConnectionAdapter(): Promise<TestConnectionResult> {
    const providers = this.metadataRegistry.getAll().filter(p => p.id.includes('stashdb'));

    if (providers.length === 0) {
      return { success: false, message: "StashDB provider not configured" };
    }

    const provider = providers[0].provider;
    const isConnected = await provider.testConnection();

    if (isConnected) {
      return { success: true, message: "Connected to StashDB successfully" };
    } else {
      return { success: false, message: "Failed to connect to StashDB" };
    }
  }

  /**
   * Test Prowlarr connection using configured adapter
   * Business rule: Validate API URL and key before testing
   */
  private async testProwlarrConnectionAdapter(): Promise<TestConnectionResult> {
    const providers = this.indexerRegistry.getAll().filter(p => p.id.includes('prowlarr'));

    if (providers.length === 0) {
      return { success: false, message: "Indexer provider not configured" };
    }

    const provider = providers[0].provider;
    const isConnected = await provider.testConnection();

    if (isConnected) {
      return { success: true, message: "Connected to Prowlarr successfully" };
    } else {
      return { success: false, message: "Failed to connect to Prowlarr" };
    }
  }

  /**
   * Test qBittorrent connection using configured adapter
   * Business rule: Validate URL and credentials before testing
   */
  private async testQBittorrentConnectionAdapter(): Promise<TestConnectionResult> {
    const providers = this.torrentClientRegistry.getAll().filter(p => p.id.includes('qbittorrent'));

    if (providers.length === 0) {
      return { success: false, message: "Torrent client not configured" };
    }

    const provider = providers[0].provider;
    const isConnected = await provider.testConnection();

    if (isConnected) {
      return { success: true, message: "Connected to qBittorrent successfully" };
    } else {
      return { success: false, message: "Failed to connect to qBittorrent" };
    }
  }
}
