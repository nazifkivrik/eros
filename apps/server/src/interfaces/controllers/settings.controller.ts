import type { Logger } from "pino";
import type { FastifyInstance } from "fastify";
import { SettingsService } from "@/application/services/settings.service.js";
import type { AuthService } from "@/application/services/auth.service.js";
import {
  SettingsSchema,
  TestServiceParamsSchema,
  MetadataProviderSchema,
  IndexerProviderSchema,
  TorrentClientSchema,
  ProviderTypeSchema,
} from "@/modules/settings/settings.schema.js";
import type { AppSettings } from "@repo/shared-types";
import type { SpeedScheduleSettings } from "@repo/shared-types";
import type { DownloadPathsSettings } from "@repo/shared-types";
import type { PathSpaceInfo } from "@repo/shared-types";
import type { ProvidersConfig, MetadataProviderConfig, IndexerProviderConfig, TorrentClientConfig } from "@repo/shared-types";
import type { CrossEncoderService } from "@/application/services/ai-matching/cross-encoder.service.js";
import type { ExternalServicesManager } from "@/config/external-services.js";
import { promises } from "fs";

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
  private authService: AuthService;
  private logger: Logger;
  private crossEncoderService?: CrossEncoderService;
  private externalServicesManager?: ExternalServicesManager;

  constructor({
    settingsService,
    authService,
    logger,
    crossEncoderService,
    externalServicesManager,
  }: {
    settingsService: SettingsService;
    authService: AuthService;
    logger: Logger;
    crossEncoderService?: CrossEncoderService;
    externalServicesManager?: ExternalServicesManager;
  }) {
    this.settingsService = settingsService;
    this.authService = authService;
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
   * Uses ExternalServicesManager to reload config (which updates registries)
   * Note: The registries are already updated by externalServicesManager.reload()
   * Legacy container updates are no longer needed as services now use registries directly
   */
  private async reloadPlugins(
    _settings: AppSettings,
    _app: FastifyInstance
  ): Promise<void> {
    this.logger.info("[Settings Reload] Starting external services reload...");

    // Reload external services configuration from database
    // This updates the registries which are used by all services
    if (this.externalServicesManager) {
      await this.externalServicesManager.reload();
      this.logger.info("[Settings Reload] External services configuration reloaded from database");
    }

    // Get updated registry info for logging
    const config = this.externalServicesManager?.getConfig();
    const metadataProviders = config?.providers?.metadata || [];
    const indexers = config?.providers?.indexers || [];
    const torrentClients = config?.providers?.torrentClients || [];

    const reloadResults: { service: string; status: string; details?: string }[] = [];

    // Log metadata providers
    for (const provider of metadataProviders) {
      reloadResults.push({
        service: provider.type === 'tpdb' ? 'TPDB' : 'StashDB',
        status: provider.enabled ? "enabled" : "disabled",
        details: `API URL: ${provider.apiUrl}`
      });
    }

    // Log indexers
    for (const indexer of indexers) {
      reloadResults.push({
        service: indexer.type === 'prowlarr' ? 'Prowlarr' : indexer.type,
        status: indexer.enabled ? "enabled" : "disabled",
        details: `Base URL: ${indexer.baseUrl}`
      });
    }

    // Log torrent clients
    for (const client of torrentClients) {
      reloadResults.push({
        service: client.type === 'qbittorrent' ? 'qBittorrent' : client.type,
        status: client.enabled ? "enabled" : "disabled",
        details: `URL: ${client.url}`
      });
    }

    // Log summary of reload results
    this.logger.info(
      { results: reloadResults },
      "[Settings Reload] Summary: All external services reloaded"
    );
  }

  /**
   * Get speed schedule settings
   */
  async getSpeedSchedule(): Promise<SpeedScheduleSettings> {
    const settings = await this.settingsService.getSettings();
    return settings.speedSchedule;
  }

  /**
   * Update speed schedule settings
   */
  async updateSpeedSchedule(body: unknown): Promise<SpeedScheduleSettings> {
    const settings = await this.settingsService.getSettings();
    const updated = {
      ...settings,
      speedSchedule: body as SpeedScheduleSettings,
    };
    await this.settingsService.updateSettings(updated);
    return (body as SpeedScheduleSettings);
  }

  /**
   * Get download paths settings
   */
  async getDownloadPaths(): Promise<DownloadPathsSettings> {
    const settings = await this.settingsService.getSettings();
    return settings.downloadPaths;
  }

  /**
   * Update download paths settings
   */
  async updateDownloadPaths(body: unknown): Promise<DownloadPathsSettings> {
    const settings = await this.settingsService.getSettings();
    const updated = {
      ...settings,
      downloadPaths: body as DownloadPathsSettings,
    };
    await this.settingsService.updateSettings(updated);
    return (body as DownloadPathsSettings);
  }

  /**
   * Check disk space for a path
   */
  async checkPathSpace(path: string): Promise<PathSpaceInfo> {
    try {
      const stats = await promises.statfs(path);
      const free = stats.bavail * stats.frsize;
      const total = stats.blocks * stats.frsize;
      const used = total - free;

      return {
        path,
        free,
        total,
        used,
        freePercent: (free / total) * 100,
        usedPercent: (used / total) * 100,
      };
    } catch (error) {
      this.logger.error({ path, error }, "Failed to check path space");
      throw new Error(`Failed to check disk space for path: ${path}`);
    }
  }

  /**
   * Change user password
   */
  async changePassword(body: { currentPassword: string; newPassword: string }): Promise<{
    success: boolean;
    message: string;
  }> {
    // TODO: Implement password change logic
    // This will require:
    // 1. User authentication system
    // 2. Password hashing (bcrypt/argon2)
    // 3. User database/storage

    this.logger.info("Password change requested");
    return {
      success: false,
      message: "Password change not yet implemented",
    };
  }

  /**
   * Change user username
   */
  async changeUsername(body: { currentPassword: string; newUsername: string }): Promise<{
    success: boolean;
    message: string;
  }> {
    // Get user ID from session (default to admin user for now)
    // TODO: Get actual user ID from session when auth is fully implemented
    const userId = "1"; // Default admin user ID

    this.logger.info({ userId, newUsername: body.newUsername }, "Username change requested via controller");

    return await this.authService.changeUsername(userId, body.newUsername, body.currentPassword);
  }

  /**
   * Generate a unique provider ID
   */
  private generateProviderId(): string {
    return `prov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all providers
   */
  async getProviders(): Promise<ProvidersConfig> {
    const settings = await this.settingsService.getSettings();
    return settings.providers || { metadata: [], indexers: [], torrentClients: [] };
  }

  /**
   * Add a metadata provider
   */
  async addMetadataProvider(body: unknown): Promise<MetadataProviderConfig> {
    const validated = MetadataProviderSchema.parse(body);
    const providers = await this.getProviders();

    const newProvider: MetadataProviderConfig = {
      ...validated,
      id: this.generateProviderId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    providers.metadata.push(newProvider);

    // Update settings
    const settings = await this.settingsService.getSettings();
    await this.settingsService.updateSettings({
      ...settings,
      providers,
    });

    // Reload external services
    if (this.externalServicesManager) {
      await this.externalServicesManager.reload();
    }

    this.logger.info({ provider: newProvider }, "Metadata provider added");
    return newProvider;
  }

  /**
   * Update a metadata provider
   */
  async updateMetadataProvider(id: string, body: unknown): Promise<MetadataProviderConfig> {
    const validated = MetadataProviderSchema.partial().parse(body);
    const providers = await this.getProviders();
    const index = providers.metadata.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error(`Metadata provider with ID ${id} not found`);
    }

    providers.metadata[index] = {
      ...providers.metadata[index],
      ...validated,
      updatedAt: new Date().toISOString(),
    };

    // Update settings
    const settings = await this.settingsService.getSettings();
    await this.settingsService.updateSettings({
      ...settings,
      providers,
    });

    // Reload external services
    if (this.externalServicesManager) {
      await this.externalServicesManager.reload();
    }

    this.logger.info({ providerId: id }, "Metadata provider updated");
    return providers.metadata[index];
  }

  /**
   * Delete a metadata provider
   */
  async deleteMetadataProvider(id: string): Promise<void> {
    const providers = await this.getProviders();
    const index = providers.metadata.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error(`Metadata provider with ID ${id} not found`);
    }

    providers.metadata.splice(index, 1);

    // Update settings
    const settings = await this.settingsService.getSettings();
    await this.settingsService.updateSettings({
      ...settings,
      providers,
    });

    // Reload external services
    if (this.externalServicesManager) {
      await this.externalServicesManager.reload();
    }

    this.logger.info({ providerId: id }, "Metadata provider deleted");
  }

  /**
   * Add an indexer provider
   */
  async addIndexerProvider(body: unknown): Promise<IndexerProviderConfig> {
    const validated = IndexerProviderSchema.parse(body);
    const providers = await this.getProviders();

    const newProvider: IndexerProviderConfig = {
      ...validated,
      id: this.generateProviderId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    providers.indexers.push(newProvider);

    // Update settings
    const settings = await this.settingsService.getSettings();
    await this.settingsService.updateSettings({
      ...settings,
      providers,
    });

    // Reload external services
    if (this.externalServicesManager) {
      await this.externalServicesManager.reload();
    }

    this.logger.info({ provider: newProvider }, "Indexer provider added");
    return newProvider;
  }

  /**
   * Update an indexer provider
   */
  async updateIndexerProvider(id: string, body: unknown): Promise<IndexerProviderConfig> {
    const validated = IndexerProviderSchema.partial().parse(body);
    const providers = await this.getProviders();
    const index = providers.indexers.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error(`Indexer provider with ID ${id} not found`);
    }

    providers.indexers[index] = {
      ...providers.indexers[index],
      ...validated,
      updatedAt: new Date().toISOString(),
    };

    // Update settings
    const settings = await this.settingsService.getSettings();
    await this.settingsService.updateSettings({
      ...settings,
      providers,
    });

    // Reload external services
    if (this.externalServicesManager) {
      await this.externalServicesManager.reload();
    }

    this.logger.info({ providerId: id }, "Indexer provider updated");
    return providers.indexers[index];
  }

  /**
   * Delete an indexer provider
   */
  async deleteIndexerProvider(id: string): Promise<void> {
    const providers = await this.getProviders();
    const index = providers.indexers.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error(`Indexer provider with ID ${id} not found`);
    }

    providers.indexers.splice(index, 1);

    // Update settings
    const settings = await this.settingsService.getSettings();
    await this.settingsService.updateSettings({
      ...settings,
      providers,
    });

    // Reload external services
    if (this.externalServicesManager) {
      await this.externalServicesManager.reload();
    }

    this.logger.info({ providerId: id }, "Indexer provider deleted");
  }

  /**
   * Add a torrent client provider
   */
  async addTorrentClientProvider(body: unknown): Promise<TorrentClientConfig> {
    const validated = TorrentClientSchema.parse(body);
    const providers = await this.getProviders();

    const newProvider: TorrentClientConfig = {
      ...validated,
      id: this.generateProviderId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    providers.torrentClients.push(newProvider);

    // Update settings
    const settings = await this.settingsService.getSettings();
    await this.settingsService.updateSettings({
      ...settings,
      providers,
    });

    // Reload external services
    if (this.externalServicesManager) {
      await this.externalServicesManager.reload();
    }

    this.logger.info({ provider: newProvider }, "Torrent client provider added");
    return newProvider;
  }

  /**
   * Update a torrent client provider
   */
  async updateTorrentClientProvider(id: string, body: unknown): Promise<TorrentClientConfig> {
    const validated = TorrentClientSchema.partial().parse(body);
    const providers = await this.getProviders();
    const index = providers.torrentClients.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error(`Torrent client provider with ID ${id} not found`);
    }

    providers.torrentClients[index] = {
      ...providers.torrentClients[index],
      ...validated,
      updatedAt: new Date().toISOString(),
    };

    // Update settings
    const settings = await this.settingsService.getSettings();
    await this.settingsService.updateSettings({
      ...settings,
      providers,
    });

    // Reload external services
    if (this.externalServicesManager) {
      await this.externalServicesManager.reload();
    }

    this.logger.info({ providerId: id }, "Torrent client provider updated");
    return providers.torrentClients[index];
  }

  /**
   * Delete a torrent client provider
   */
  async deleteTorrentClientProvider(id: string): Promise<void> {
    const providers = await this.getProviders();
    const index = providers.torrentClients.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error(`Torrent client provider with ID ${id} not found`);
    }

    providers.torrentClients.splice(index, 1);

    // Update settings
    const settings = await this.settingsService.getSettings();
    await this.settingsService.updateSettings({
      ...settings,
      providers,
    });

    // Reload external services
    if (this.externalServicesManager) {
      await this.externalServicesManager.reload();
    }

    this.logger.info({ providerId: id }, "Torrent client provider deleted");
  }

  /**
   * Test a provider connection
   */
  async testProviderConnection(
    type: "metadata" | "indexer" | "torrentClient",
    id: string
  ): Promise<{ success: boolean; message: string }> {
    const providers = await this.getProviders();
    let provider: MetadataProviderConfig | IndexerProviderConfig | TorrentClientConfig | undefined;

    if (type === "metadata") {
      provider = providers.metadata.find((p) => p.id === id);
    } else if (type === "indexer") {
      provider = providers.indexers.find((p) => p.id === id);
    } else if (type === "torrentClient") {
      provider = providers.torrentClients.find((p) => p.id === id);
    }

    if (!provider) {
      return {
        success: false,
        message: `Provider with ID ${id} not found`,
      };
    }

    try {
      let adapter: any;
      let connected = false;

      if (provider.type === "tpdb") {
        adapter = createTPDBAdapter(
          { apiUrl: provider.apiUrl, apiKey: provider.apiKey },
          this.logger
        );
        connected = await adapter.testConnection();
      } else if (provider.type === "stashdb") {
        adapter = createStashDBAdapter(
          { apiUrl: provider.apiUrl, apiKey: provider.apiKey },
          this.logger
        );
        connected = await adapter.testConnection();
      } else if (provider.type === "prowlarr") {
        adapter = createProwlarrAdapter(
          { baseUrl: provider.baseUrl, apiKey: provider.apiKey },
          this.logger
        );
        connected = await adapter.testConnection();
      } else if (provider.type === "qbittorrent") {
        adapter = createQBittorrentAdapter(
          { url: provider.url, username: provider.username, password: provider.password },
          this.logger
        );
        connected = await adapter.testConnection();
      } else if (provider.type === "jackett") {
        // Future: Jackett support
        return {
          success: false,
          message: "Jackett support not yet implemented",
        };
      } else if (provider.type === "transmission") {
        // Future: Transmission support
        return {
          success: false,
          message: "Transmission support not yet implemented",
        };
      }

      if (connected) {
        return {
          success: true,
          message: `Successfully connected to ${provider.name} (${provider.type})`,
        };
      } else {
        return {
          success: false,
          message: `Failed to connect to ${provider.name}. Check your configuration.`,
        };
      }
    } catch (error) {
      this.logger.error({ error, providerId: id }, "Provider connection test failed");
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
