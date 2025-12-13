/**
 * Settings Service
 * Handles application settings storage and retrieval
 */

import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { appSettings } from "@repo/database";
import type * as schema from "@repo/database";

interface AppSettings {
  general: {
    appName: string;
    downloadPath: string;
    scenesPath: string;
    incompletePath: string;
    enableNotifications: boolean;
    minIndexersForMetadataLess: number;
    groupingThreshold: number; // Threshold for merging truncated scene titles (0.0-1.0)
  };
  fileManagement: {
    deleteFilesOnRemove: boolean; // Re-download scene when files are manually deleted from filesystem
    deleteTorrentOnRemove: boolean; // Re-add torrent when manually removed from qBittorrent
    removeFromQbitAfterDays: number;
    renameOnMetadata: boolean;
  };
  stashdb: {
    apiUrl: string;
    apiKey: string;
    enabled: boolean;
  };
  prowlarr: {
    apiUrl: string;
    apiKey: string;
    enabled: boolean;
  };
  qbittorrent: {
    url: string;
    username: string;
    password: string;
    enabled: boolean;
  };
  ai: {
    enabled: boolean; // Enable AI-powered scene matching with local embeddings
    model: string; // Local embedding model (e.g., "Xenova/all-MiniLM-L6-v2")
    threshold: number; // Cosine similarity threshold for AI matching (0.0-1.0)
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  general: {
    appName: "Eros",
    downloadPath: "/downloads",
    scenesPath: "/scenes",
    incompletePath: "/incomplete",
    enableNotifications: true,
    minIndexersForMetadataLess: 2,
    groupingThreshold: 0.7, // 70% match required for truncated title merging
  },
  fileManagement: {
    deleteFilesOnRemove: false, // Don't re-download by default
    deleteTorrentOnRemove: false, // Don't re-add by default (will unsubscribe)
    removeFromQbitAfterDays: 7,
    renameOnMetadata: true,
  },
  stashdb: {
    apiUrl: "https://stashdb.org/graphql",
    apiKey: "",
    enabled: false,
  },
  prowlarr: {
    apiUrl: "",
    apiKey: "",
    enabled: false,
  },
  qbittorrent: {
    url: "",
    username: "",
    password: "",
    enabled: false,
  },
  ai: {
    enabled: false,
    model: "Xenova/all-MiniLM-L6-v2", // Local sentence transformer model
    threshold: 0.75, // 75% cosine similarity for AI matching
  },
};

export class SettingsService {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * Get all settings
   */
  async getSettings(): Promise<AppSettings> {
    const setting = await this.db.query.appSettings.findFirst({
      where: eq(appSettings.key, "app-settings"),
    });

    if (setting) {
      return setting.value as AppSettings;
    }

    // Return defaults if not found
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

    console.log("[SettingsService] Settings updated successfully");
    return settings;
  }

  /**
   * Test connection to a service
   */
  async testConnection(
    service: "stashdb" | "prowlarr" | "qbittorrent"
  ): Promise<{ success: boolean; message: string }> {
    const settings = await this.getSettings();

    try {
      switch (service) {
        case "stashdb":
          return await this.testStashDBConnection(settings.stashdb);
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

      const data = await response.json();

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
  db: BetterSQLite3Database<typeof schema>
) {
  return new SettingsService(db);
}
