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
import type { CrossEncoderService } from "../../application/services/ai-matching/cross-encoder.service.js";
import type { ExternalServicesManager } from "../../config/external-services.js";
import type { ServiceContainer } from "../../container/types.js";

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
  private crossEncoderService?: CrossEncoderService;
  private externalServicesManager?: ExternalServicesManager;

  constructor({
    settingsService,
    logger,
    crossEncoderService,
    externalServicesManager,
  }: {
    settingsService: SettingsService;
    logger: Logger;
    crossEncoderService?: CrossEncoderService;
    externalServicesManager?: ExternalServicesManager;
  }) {
    this.settingsService = settingsService;
    this.logger = logger;
    this.crossEncoderService = crossEncoderService;
    this.externalServicesManager = externalServicesManager;
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
  async getAIModelStatus() {
    if (!this.crossEncoderService) {
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
    const loadError = this.crossEncoderService.getLoadError();

    const isModelDownloaded = this.crossEncoderService.isModelDownloaded();
    const isModelLoaded = this.crossEncoderService.isModelLoaded();

    this.logger.info({
      isModelDownloaded,
      isModelLoaded,
    }, 'AI model status check');

    return {
      enabled: settings.ai.useCrossEncoder,
      modelLoaded: isModelLoaded,
      modelDownloaded: isModelDownloaded,
      modelName: 'Xenova/ms-marco-MiniLM-L-6-v2',
      modelPath: this.crossEncoderService.getModelPath(),
      error: loadError ? loadError.message : null
    };
  }

  /**
   * Manually load AI model into RAM
   */
  async loadAIModel() {
    if (!this.crossEncoderService) {
      throw new Error('Cross-Encoder service not available');
    }

    try {
      this.logger.info('Manual AI model download requested');
      await this.crossEncoderService.initialize();

      return {
        success: true,
        message: 'Model loaded successfully',
        modelLoaded: this.crossEncoderService.isModelLoaded(),
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to load AI model');
      throw error;
    }
  }

  /**
   * Reload external services adapters with new settings
   * Uses ExternalServicesManager to reload config and updates container adapters
   */
  private async reloadPlugins(
    _settings: AppSettings,
    app: FastifyInstance
  ): Promise<void> {
    // Reload external services configuration from database
    if (this.externalServicesManager) {
      await this.externalServicesManager.reload();
      this.logger.info("External services configuration reloaded");
    }

    // Get updated config
    const config = this.externalServicesManager?.getConfig() || {};

    // Update StashDB adapter in container
    if (config.stashdb) {
      const stashdb = createStashDBAdapter(config.stashdb, this.logger);
      (app.container as ServiceContainer).stashdbProvider = stashdb;
      (app.container as ServiceContainer).metadataProvider = stashdb; // Update generic provider
      this.logger.info("StashDB adapter reloaded with new configuration");
    } else {
      (app.container as ServiceContainer).stashdbProvider = undefined;
      // Update generic provider to TPDB if available
      if (config.tpdb) {
        const tpdb = createTPDBAdapter(config.tpdb, this.logger);
        (app.container as ServiceContainer).metadataProvider = tpdb;
      } else {
        (app.container as ServiceContainer).metadataProvider = undefined;
      }
    }

    // Update TPDB adapter in container
    if (config.tpdb) {
      const tpdb = createTPDBAdapter(config.tpdb, this.logger);
      (app.container as ServiceContainer).tpdbProvider = tpdb;
      (app.container as ServiceContainer).metadataProvider = tpdb; // TPDB has priority
      this.logger.info("TPDB adapter reloaded with new configuration");
    } else {
      (app.container as ServiceContainer).tpdbProvider = undefined;
      // Update generic provider to StashDB if available
      if (config.stashdb) {
        const stashdb = createStashDBAdapter(config.stashdb, this.logger);
        (app.container as ServiceContainer).metadataProvider = stashdb;
      } else {
        (app.container as ServiceContainer).metadataProvider = undefined;
      }
    }

    // Update qBittorrent adapter in container
    if (config.qbittorrent) {
      const qbittorrent = createQBittorrentAdapter(config.qbittorrent, this.logger);
      const connected = await qbittorrent.testConnection();
      if (connected) {
        (app.container as ServiceContainer).torrentClient = qbittorrent;
        this.logger.info("qBittorrent adapter reloaded and connected");
      } else {
        (app.container as ServiceContainer).torrentClient = undefined;
        this.logger.warn("qBittorrent adapter reloaded but connection failed");
      }
    } else {
      (app.container as ServiceContainer).torrentClient = undefined;
    }

    // Update Prowlarr adapter in container
    if (config.prowlarr) {
      const prowlarr = createProwlarrAdapter(config.prowlarr, this.logger);
      (app.container as ServiceContainer).indexer = prowlarr;
      this.logger.info("Prowlarr adapter reloaded with new configuration");
    } else {
      (app.container as ServiceContainer).indexer = undefined;
    }
  }
}
