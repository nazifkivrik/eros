import type { Logger } from "pino";
import type { FastifyInstance } from "fastify";
import { SettingsService } from "../../application/services/settings.service.js";
import {
  SettingsSchema,
  TestServiceParamsSchema,
} from "../../modules/settings/settings.schema.js";
import { QBittorrentService } from "../../services/qbittorrent.service.js";
import { TPDBService } from "../../services/tpdb/tpdb.service.js";
import { StashDBService } from "../../services/stashdb.service.js";
import type { AppSettings } from "@repo/shared-types";

/**
 * Settings Controller
 * Handles HTTP request/response for settings endpoints
 * Responsibilities:
 * - Request validation (Zod)
 * - Calling service methods
 * - Plugin reloading (Fastify-specific concern)
 * - Error handling
 * - Response formatting
 */
export class SettingsController {
  private settingsService: SettingsService;
  private logger: Logger;

  constructor({
    settingsService,
    logger,
  }: {
    settingsService: SettingsService;
    logger: Logger;
  }) {
    this.settingsService = settingsService;
    this.logger = logger;
  }

  /**
   * Get all settings
   */
  async getSettings() {
    return await this.settingsService.getSettings();
  }

  /**
   * Update settings
   * HTTP Concern: Reload Fastify plugins after settings update
   */
  async updateSettings(body: unknown, app: FastifyInstance): Promise<AppSettings> {
    const validated = SettingsSchema.parse(body);

    // Update settings via service
    const updatedSettings = await this.settingsService.updateSettings(validated);

    // HTTP concern: Reload plugins with new settings
    await this.reloadPlugins(updatedSettings, app);

    return updatedSettings;
  }

  /**
   * Test service connection
   */
  async testConnection(params: unknown) {
    const { service } = TestServiceParamsSchema.parse(params);
    return await this.settingsService.testConnection({ service });
  }

  /**
   * Test TPDB connection with provided credentials
   */
  async testTPDBConnection(body: { apiUrl: string; apiKey: string }) {
    const isConnected = await this.settingsService.testTPDBConnectionPublic(
      body.apiUrl,
      body.apiKey
    );

    return {
      success: isConnected,
      message: isConnected
        ? "Successfully connected to TPDB"
        : "Failed to connect to TPDB. Check your API URL and key.",
    };
  }

  /**
   * Get qBittorrent status
   */
  async getQBittorrentStatus() {
    return await this.settingsService.getQBittorrentStatus();
  }

  /**
   * Reload Fastify plugins with new settings
   * HTTP Concern: Direct manipulation of Fastify decorators
   */
  private async reloadPlugins(
    settings: AppSettings,
    app: FastifyInstance
  ): Promise<void> {
    // Reload StashDB plugin
    if (settings.stashdb?.apiKey) {
      const stashdb = new StashDBService({
        apiUrl: "https://stashdb.org/graphql",
        apiKey: settings.stashdb.apiKey,
      });
      // Directly reassign the decorator value
      app.stashdb = stashdb;
      this.logger.info("StashDB plugin reloaded with new API key");
    }

    // Reload TPDB plugin
    if (settings.tpdb?.apiKey) {
      const tpdb = new TPDBService({
        apiUrl: settings.tpdb.apiUrl || "https://api.theporndb.net",
        apiKey: settings.tpdb.apiKey,
      });
      app.tpdb = tpdb;
      this.logger.info("TPDB plugin reloaded with new API key");
    }

    // Reload qBittorrent plugin
    if (settings.qbittorrent?.enabled && settings.qbittorrent?.url) {
      const qbittorrent = new QBittorrentService({
        url: settings.qbittorrent.url,
        username: settings.qbittorrent.username || "admin",
        password: settings.qbittorrent.password || "adminadmin",
      });

      try {
        const connected = await qbittorrent.testConnection();
        if (connected) {
          app.qbittorrent = qbittorrent;
          this.logger.info("qBittorrent plugin reloaded and connected");
        } else {
          app.qbittorrent = null;
          this.logger.warn("qBittorrent plugin reloaded but connection failed");
        }
      } catch (error) {
        app.qbittorrent = null;
        this.logger.error({ error }, "Failed to reload qBittorrent plugin");
      }
    } else {
      app.qbittorrent = null;
    }
  }
}
