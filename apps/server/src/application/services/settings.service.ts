import type { Logger } from "pino";
import { DEFAULT_SETTINGS, type AppSettings } from "@repo/shared-types";
import { SettingsRepository } from "../../infrastructure/repositories/settings.repository.js";
import { QBittorrentService } from "../../services/qbittorrent.service.js";
import { TPDBService } from "../../services/tpdb/tpdb.service.js";
import { StashDBService } from "../../services/stashdb.service.js";

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

  constructor({ settingsRepository, logger }: { settingsRepository: SettingsRepository; logger: Logger }) {
    this.settingsRepository = settingsRepository;
    this.logger = logger;
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
   * Business rule: Validate configuration before testing
   */
  async testConnection(dto: TestConnectionDTO): Promise<TestConnectionResult> {
    this.logger.info({ service: dto.service, serviceType: typeof dto.service }, "Testing service connection");

    const settings = await this.getSettings();

    try {
      switch (dto.service) {
        case "stashdb":
          return await this.testStashDBConnection(settings.stashdb);
        case "tpdb":
          return await this.testTPDBConnection(settings.tpdb);
        case "prowlarr":
          return await this.testProwlarrConnection(settings.prowlarr);
        case "qbittorrent":
          return await this.testQBittorrentConnection(settings.qbittorrent);
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
   * Test TPDB connection with provided credentials
   * Business logic: Test connection without saving to settings
   */
  async testTPDBConnectionPublic(apiUrl: string, apiKey: string): Promise<boolean> {
    this.logger.info("Testing TPDB connection (public)");

    try {
      const tpdb = new TPDBService({ apiUrl, apiKey });
      const result = await tpdb.testConnection();

      this.logger.info({ success: result }, "TPDB connection test result");
      return result;
    } catch (error) {
      this.logger.error({ error }, "TPDB connection test failed");
      return false;
    }
  }

  /**
   * Get qBittorrent status
   * Business logic: Check connection and retrieve stats
   */
  async getQBittorrentStatus(): Promise<QBittorrentStatusDTO> {
    this.logger.debug("Fetching qBittorrent status");

    const settings = await this.getSettings();
    const qbConfig = settings.qbittorrent;

    if (!qbConfig.enabled || !qbConfig.url) {
      return {
        connected: false,
        error: "qBittorrent not configured",
      };
    }

    try {
      const qbService = new QBittorrentService({
        url: qbConfig.url,
        username: qbConfig.username,
        password: qbConfig.password,
      });

      const torrents = await qbService.getTorrents();
      const downloadSpeed = torrents.reduce((sum, t) => sum + (t.dlspeed || 0), 0);
      const uploadSpeed = torrents.reduce((sum, t) => sum + (t.upspeed || 0), 0);

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
   * Test TPDB connection (private helper)
   * Business rule: Validate API URL and key before testing
   */
  private async testTPDBConnection(config: {
    apiUrl: string;
    apiKey: string;
  }): Promise<TestConnectionResult> {
    if (!config.apiUrl) {
      return { success: false, message: "API URL is required" };
    }

    if (!config.apiKey) {
      return { success: false, message: "API Key is required" };
    }

    try {
      const tpdb = new TPDBService({ apiUrl: config.apiUrl, apiKey: config.apiKey });
      const isConnected = await tpdb.testConnection();

      if (isConnected) {
        return { success: true, message: "Connected to TPDB successfully" };
      } else {
        return { success: false, message: "Failed to connect to TPDB" };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Test StashDB connection (private helper)
   * Business rule: Send test GraphQL query to verify connectivity
   */
  private async testStashDBConnection(config: {
    apiUrl: string;
    apiKey: string;
  }): Promise<TestConnectionResult> {
    if (!config.apiUrl) {
      return { success: false, message: "API URL is required" };
    }

    try {
      // Simple query to test connection
      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { ApiKey: config.apiKey } : {}),
        },
        body: JSON.stringify({
          query: "{ __typename }",
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = (await response.json()) as { errors?: Array<{ message: string }> };

      if (data.errors) {
        return {
          success: false,
          message: `GraphQL error: ${data.errors[0].message}`,
        };
      }

      return { success: true, message: "Connected to StashDB successfully" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Test Prowlarr connection (private helper)
   * Business rule: Validate API key by calling Prowlarr API
   */
  private async testProwlarrConnection(config: {
    apiUrl: string;
    apiKey: string;
  }): Promise<TestConnectionResult> {
    if (!config.apiUrl) {
      return { success: false, message: "API URL is required" };
    }

    if (!config.apiKey) {
      return { success: false, message: "API Key is required" };
    }

    try {
      // Test with /api/v1/indexer endpoint
      const response = await fetch(`${config.apiUrl}/api/v1/indexer`, {
        headers: {
          "X-Api-Key": config.apiKey,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, message: "Invalid API key" };
        }
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { success: true, message: "Connected to Prowlarr successfully" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Test qBittorrent connection (private helper)
   * Business rule: Attempt login to validate credentials
   */
  private async testQBittorrentConnection(config: {
    url: string;
    username: string;
    password: string;
  }): Promise<TestConnectionResult> {
    if (!config.url) {
      return { success: false, message: "URL is required" };
    }

    try {
      // Try to login
      const response = await fetch(`${config.url}/api/v2/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: config.username,
          password: config.password,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const text = await response.text();

      if (text === "Fails.") {
        return { success: false, message: "Invalid username or password" };
      }

      return {
        success: true,
        message: "Connected to qBittorrent successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }
}
