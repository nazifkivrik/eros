/**
 * Settings Service
 * Handles application settings storage and retrieval
 */

import { eq } from "drizzle-orm";
import type { Database } from "@repo/database";
import { appSettings } from "@repo/database";
import { DEFAULT_SETTINGS, type AppSettings } from "@repo/shared-types";

export class SettingsService {
  constructor(private db: Database) {}


  /**
   * Get all settings
   */
  async getSettings(): Promise<AppSettings> {
    const setting = await this.db.query.appSettings.findFirst({
      where: eq(appSettings.key, "app-settings"),
    });

    if (setting) {
      // Deep merge saved settings over DEFAULT_SETTINGS to ensure all required fields exist
      const savedSettings = setting.value as Partial<AppSettings>;

      // Debug log
      app.log.info(
        {
          hasStashdb: !!savedSettings.stashdb,
          stashdbEnabled: savedSettings.stashdb?.enabled,
          hasApiKey: !!savedSettings.stashdb?.apiKey,
          apiKeyLength: savedSettings.stashdb?.apiKey?.length,
        },
        "[SettingsService] Loaded from DB"
      );

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
        metadata: {
          ...DEFAULT_SETTINGS.metadata,
          ...(savedSettings.metadata || {}),
        },
        prowlarr: {
          ...DEFAULT_SETTINGS.prowlarr,
          ...(savedSettings.prowlarr || {}),
        },
        qbittorrent: {
          ...DEFAULT_SETTINGS.qbittorrent,
          ...(savedSettings.qbittorrent || {}),
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

    // Return pure DEFAULT_SETTINGS if not found
    return DEFAULT_SETTINGS;
  }

  /**
   * Update settings
   */
  async updateSettings(settings: AppSettings): Promise<AppSettings> {
    const now = new Date().toISOString();

    // Check if settings exist
    const existing = await this.db.query.appSettings.findFirst({
      where: eq(appSettings.key, "app-settings"),
    });

    if (existing) {
      // Update existing
      await this.db
        .update(appSettings)
        .set({
          value: settings,
          updatedAt: now,
        })
        .where(eq(appSettings.key, "app-settings"));
    } else {
      // Insert new
      await this.db.insert(appSettings).values({
        key: "app-settings",
        value: settings,
        updatedAt: now,
      });
    }

    app.log.info("[SettingsService] Settings updated successfully");
    return settings;
  }

  /**
   * Test connection to a service
   */
  async testConnection(
    service: "stashdb" | "tpdb" | "prowlarr" | "qbittorrent"
  ): Promise<{ success: boolean; message: string }> {
    const settings = await this.getSettings();

    try {
      switch (service) {
        case "stashdb":
          return await this.testStashDBConnection(settings.stashdb);
        case "tpdb":
          return await this.testTPDBConnection(settings.tpdb);
        case "prowlarr":
          return await this.testProwlarrConnection(settings.prowlarr);
        case "qbittorrent":
          return await this.testQBittorrentConnection(settings.qbittorrent);
        default:
          return { success: false, message: "Unknown service" };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Test TPDB connection (wrapper)
   */
  private async testTPDBConnection(config: {
    apiUrl: string;
    apiKey: string;
  }): Promise<{ success: boolean; message: string }> {
    if (!config.apiUrl) {
      return { success: false, message: "API URL is required" };
    }

    if (!config.apiKey) {
      return { success: false, message: "API Key is required" };
    }

    try {
      const { TPDBService } = await import("./tpdb/tpdb.service.js");
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
   * Test TPDB connection (public method for routes)
   */
  async testTPDBConnectionPublic(apiUrl: string, apiKey: string): Promise<boolean> {
    try {
      const { TPDBService } = await import("./tpdb/tpdb.service.js");
      const tpdb = new TPDBService({ apiUrl, apiKey });
      return await tpdb.testConnection();
    } catch (error) {
      return false;
    }
  }

  /**
   * Test StashDB connection
   */
  private async testStashDBConnection(config: {
    apiUrl: string;
    apiKey: string;
  }): Promise<{ success: boolean; message: string }> {
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

      const data = await response.json() as { errors?: Array<{ message: string }> };

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
   * Test Prowlarr connection
   */
  private async testProwlarrConnection(config: {
    apiUrl: string;
    apiKey: string;
  }): Promise<{ success: boolean; message: string }> {
    if (!config.apiUrl) {
      return { success: false, message: "API URL is required" };
    }

    if (!config.apiKey) {
      return { success: false, message: "API Key is required" };
    }

    try {
      // Test with /api/v1/health endpoint (or /api/v1/indexer)
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
   * Test qBittorrent connection
   */
  private async testQBittorrentConnection(config: {
    url: string;
    username: string;
    password: string;
  }): Promise<{ success: boolean; message: string }> {
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

// Export factory function
export function createSettingsService(
  db: Database
): SettingsService {
  return new SettingsService(db);
}
