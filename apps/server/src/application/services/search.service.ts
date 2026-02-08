import type { Logger } from "pino";
import type { IMetadataProvider } from "@/infrastructure/adapters/interfaces/metadata-provider.interface.js";
import { SearchRepository } from "@/infrastructure/repositories/search.repository.js";
import { SettingsRepository } from "@/infrastructure/repositories/settings.repository.js";
import type { AppSettings } from "@repo/shared-types";
import { MetadataProviderRegistry } from "@/infrastructure/registries/provider-registry.js";

type MetadataSource = "tpdb" | "stashdb";

interface MetadataServiceResult {
  service: IMetadataProvider;
  source: MetadataSource;
}

/**
 * Search Service
 * Business logic for searching performers, studios, scenes
 * Responsibilities:
 * - Use configured metadata provider from registry
 * - Delegate searches to external metadata services
 * - Check local database first for detail queries
 */
export class SearchService {
  private searchRepository: SearchRepository;
  private settingsRepository: SettingsRepository;
  private logger: Logger;
  private metadataRegistry: MetadataProviderRegistry;

  constructor({
    searchRepository,
    settingsRepository,
    logger,
    metadataRegistry,
  }: {
    searchRepository: SearchRepository;
    settingsRepository: SettingsRepository;
    logger: Logger;
    metadataRegistry: MetadataProviderRegistry;
  }) {
    this.searchRepository = searchRepository;
    this.settingsRepository = settingsRepository;
    this.logger = logger;
    this.metadataRegistry = metadataRegistry;
  }

  /**
   * Determine which metadata service to use based on provider registry
   */
  private async getMetadataService(): Promise<MetadataServiceResult> {
    const availableProviders = this.metadataRegistry.getAvailable();

    if (availableProviders.length === 0) {
      throw new Error("No metadata service configured");
    }

    // Get first available provider (already sorted by priority in registry)
    const { provider, id } = availableProviders[0];

    // Determine source from provider ID or configuration
    const source: MetadataSource = id.includes("tpdb") ? "tpdb" : "stashdb";

    return {
      service: provider,
      source,
    };
  }

  /**
   * Search all entities (performers, studios, scenes)
   */
  async searchAll(query: string, limit?: number, page?: number) {
    const { service, source } = await this.getMetadataService();

    const [performers, studiosResult, scenes] = await Promise.all([
      service.searchPerformers(query, limit).catch((err) => {
        this.logger.error({ err, query, source }, "Failed to search performers");
        return [];
      }),
      service.searchSites(query, page).catch((err) => {
        this.logger.error({ err, query, source }, "Failed to search studios");
        return { sites: [] };
      }),
      service.searchScenes(query, limit).catch((err) => {
        this.logger.error({ err, query, source }, "Failed to search scenes");
        return [];
      }),
    ]);

    // searchSites returns { sites: [...] }, extract the sites array
    const studios = studiosResult.sites?.slice(0, limit || 10) || [];

    return {
      performers,
      studios,
      scenes,
    };
  }

  /**
   * Search performers only
   */
  async searchPerformers(query: string, limit?: number, _page?: number) {
    const { service } = await this.getMetadataService();
    return await service.searchPerformers(query, limit);
  }

  /**
   * Search studios only
   */
  async searchStudios(query: string, limit?: number, page?: number) {
    const { service } = await this.getMetadataService();

    const result = await service.searchSites(query, page);
    return result.sites?.slice(0, limit || 10) || [];
  }

  /**
   * Search scenes only
   */
  async searchScenes(query: string, limit?: number, page?: number) {
    const { service } = await this.getMetadataService();
    return await service.searchScenes(query, limit, page);
  }

  /**
   * Get performer details by ID
   * Checks local database first, then fetches from external service
   */
  async getPerformerDetails(id: string) {
    // First check local database
    const localPerformer = await this.searchRepository.findPerformerById(id);
    if (localPerformer) {
      return localPerformer;
    }

    // If not found locally, fetch from external service
    try {
      const { service } = await this.getMetadataService();
      return await service.getPerformerById(id);
    } catch (error) {
      this.logger.error({ error, id }, "Failed to fetch performer from metadata service");
      return null;
    }
  }

  /**
   * Get studio details by ID
   */
  async getStudioDetails(id: string) {
    // First check local database
    const localStudio = await this.searchRepository.findStudioById(id);
    if (localStudio) {
      return localStudio;
    }

    // Fetch from external service
    try {
      const { service } = await this.getMetadataService();
      return await service.getStudioById(id);
    } catch (error) {
      this.logger.error({ error, id }, "Failed to fetch studio details");
      return null;
    }
  }

  /**
   * Get scene details by ID
   * Checks local database first (includes files), then fetches from external service
   */
  async getSceneDetails(id: string) {
    // First check local database (includes sceneFiles)
    const localScene = await this.searchRepository.findSceneById(id);
    if (localScene) {
      return {
        ...localScene,
        files: localScene.sceneFiles || [],
      };
    }

    // Fetch from external service
    try {
      const { service } = await this.getMetadataService();
      return await service.getSceneById(id);
    } catch (error) {
      this.logger.error({ error, id }, "Failed to fetch scene details");
      return null;
    }
  }
}
