import type { Logger } from "pino";
import type { FastifyInstance } from "fastify";
import { SettingsService } from "../../application/services/settings.service.js";
import {
  SettingsSchema,
  TestServiceParamsSchema,
} from "../../modules/settings/settings.schema.js";
import { createQBittorrentAdapter } from "../../infrastructure/adapters/qbittorrent.adapter.js";
import { createTPDBAdapter } from "../../infrastructure/adapters/tpdb.adapter.js";
import { createStashDBAdapter } from "../../infrastructure/adapters/stashdb.adapter.js";
import { createProwlarrAdapter } from "../../infrastructure/adapters/prowlarr.adapter.js";
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
   * Get AI model status
   */
  async getAIModelStatus(app: FastifyInstance) {
    const crossEncoderService = (app.container as any).crossEncoderService;
    if (!crossEncoderService) {
      return {
        enabled: false,
        modelLoaded: false,
        modelDownloaded: false,
        modelName: 'Xenova/ms-marco-MiniLM-L-6-v2',
        modelPath: './data/ai/models',
        error: 'Cross-Encoder service not available'
      };
    }

    const settings = await this.settingsService.getSettings();
    const loadError = crossEncoderService.getLoadError ? crossEncoderService.getLoadError() : null;

    // Check if methods exist and call them
    const isModelDownloaded = typeof crossEncoderService.isModelDownloaded === 'function'
      ? crossEncoderService.isModelDownloaded()
      : false;
    const isModelLoaded = typeof crossEncoderService.isModelLoaded === 'function'
      ? crossEncoderService.isModelLoaded()
      : false;

    this.logger.info({
      isModelDownloaded,
      isModelLoaded,
      hasIsModelDownloadedMethod: typeof crossEncoderService.isModelDownloaded === 'function',
      hasIsModelLoadedMethod: typeof crossEncoderService.isModelLoaded === 'function'
    }, 'AI model status check');

    return {
      enabled: settings.ai.useCrossEncoder,
      modelLoaded: isModelLoaded,
      modelDownloaded: isModelDownloaded,
      modelName: 'Xenova/ms-marco-MiniLM-L-6-v2',
      modelPath: typeof crossEncoderService.getModelPath === 'function' ? crossEncoderService.getModelPath() : './data/ai/models',
      error: loadError ? loadError.message : null
    };
  }

  /**
   * Manually load AI model into RAM
   */
  async loadAIModel(app: FastifyInstance) {
    const crossEncoderService = (app.container as any).crossEncoderService;
    if (!crossEncoderService) {
      throw new Error('Cross-Encoder service not available');
    }

    try {
      this.logger.info('Manual AI model download requested');
      await crossEncoderService.initialize();

      return {
        success: true,
        message: 'Model loaded successfully',
        modelLoaded: crossEncoderService.isModelLoaded ? crossEncoderService.isModelLoaded() : false,
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to load AI model');
      throw error;
    }
  }

  /**
   * Reload Fastify plugins with new settings
   * HTTP Concern: Direct manipulation of Fastify decorators and DI container
   */
  private async reloadPlugins(
    settings: AppSettings,
    app: FastifyInstance
  ): Promise<void> {
    // Reload StashDB plugin
    if (settings.stashdb?.apiKey) {
      const stashdb = createStashDBAdapter({
        apiUrl: "https://stashdb.org/graphql",
        apiKey: settings.stashdb.apiKey,
      }, this.logger);
      // Update Fastify decorator
      app.stashdb = stashdb as any;
      // Update DI container (direct assignment for runtime update)
      (app.container as any).stashdbService = stashdb;
      (app.container as any).stashdb = stashdb;
      this.logger.info("StashDB plugin reloaded with new API key");
    }

    // Reload TPDB plugin
    if (settings.tpdb?.apiKey) {
      const tpdb = createTPDBAdapter({
        apiUrl: settings.tpdb.apiUrl || "https://api.theporndb.net",
        apiKey: settings.tpdb.apiKey,
      }, this.logger);
      // Update Fastify decorator
      app.tpdb = tpdb as any;
      // Update DI container (direct assignment for runtime update)
      (app.container as any).tpdbService = tpdb;
      (app.container as any).tpdb = tpdb;
      this.logger.info("TPDB plugin reloaded with new API key");
    }

    // Reload qBittorrent plugin
    if (settings.qbittorrent?.enabled && settings.qbittorrent?.url) {
      const qbittorrent = createQBittorrentAdapter({
        url: settings.qbittorrent.url,
        username: settings.qbittorrent.username || "admin",
        password: settings.qbittorrent.password || "adminadmin",
      }, this.logger);

      // Test connection (adapter method)
      const connected = await qbittorrent.testConnection();
      if (connected) {
        app.qbittorrent = qbittorrent as any;
        this.logger.info("qBittorrent plugin reloaded and connected");
      } else {
        app.qbittorrent = null;
        this.logger.warn("qBittorrent plugin reloaded but connection failed");
      }
    } else {
      app.qbittorrent = null;
    }

    // Reload Prowlarr plugin
    if (settings.prowlarr?.enabled && settings.prowlarr?.apiUrl && settings.prowlarr?.apiKey) {
      const prowlarr = createProwlarrAdapter({
        baseUrl: settings.prowlarr.apiUrl,
        apiKey: settings.prowlarr.apiKey,
      }, this.logger);

      // Update Fastify decorator
      app.prowlarr = prowlarr as any;
      // Update DI container (direct assignment for runtime update)
      (app.container as any).prowlarrService = prowlarr;
      (app.container as any).prowlarr = prowlarr;
      this.logger.info("Prowlarr plugin reloaded with new configuration");
    } else {
      app.prowlarr = null;
      (app.container as any).prowlarrService = null;
      (app.container as any).prowlarr = null;
    }
  }
}
