import type { Logger } from "pino";
import type { IMetadataProvider } from "@/infrastructure/adapters/interfaces/metadata-provider.interface.js";
import { SearchRepository } from "@/infrastructure/repositories/search.repository.js";
import { SettingsRepository } from "@/infrastructure/repositories/settings.repository.js";
import type { AppSettings } from "@repo/shared-types";

type MetadataSource = "tpdb" | "stashdb";

interface MetadataServiceResult {
  service: IMetadataProvider;
  source: MetadataSource;
}

/**
 * Search Service
 * Business logic for searching performers, studios, scenes
 * Responsibilities:
 * - Determine which metadata service to use (TPDB vs StashDB)
 * - Delegate searches to external metadata services
 * - Check local database first for detail queries
 * - UUID validation for TPDB lookups
 */
export class SearchService {
  private searchRepository: SearchRepository;
  private settingsRepository: SettingsRepository;
  private logger: Logger;
  private tpdbProvider?: IMetadataProvider;
  private stashdbProvider?: IMetadataProvider;

  constructor({
    searchRepository,
    settingsRepository,
    logger,
    tpdbProvider,
    stashdbProvider,
  }: {
    searchRepository: SearchRepository;
    settingsRepository: SettingsRepository;
    logger: Logger;
    tpdbProvider?: IMetadataProvider;
    stashdbProvider?: IMetadataProvider;
  }) {
    this.searchRepository = searchRepository;
    this.settingsRepository = settingsRepository;
    this.logger = logger;
    this.tpdbProvider = tpdbProvider;
    this.stashdbProvider = stashdbProvider;
  }

  /**
   * Determine which metadata service to use based on settings
   */
  private async getMetadataService(): Promise<MetadataServiceResult> {
    const settingRecord = await this.settingsRepository.findByKey("app-settings");
    const settings = settingRecord?.value as AppSettings | undefined;

    // Use TPDB if enabled and configured
    if (
      settings?.tpdb?.enabled &&
      settings.tpdb.apiKey &&
      this.tpdbProvider
    ) {
      return {
        service: this.tpdbProvider,
        source: "tpdb",
      };
    }

    // Fall back to StashDB
    if (settings?.stashdb?.enabled && this.stashdbProvider) {
      return {
        service: this.stashdbProvider,
        source: "stashdb",
      };
    }

    throw new Error("No metadata service configured");
  }

  /**
   * Validate UUID format for TPDB lookups
   */
  private isValidUUID(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id
    );
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

    // If not found locally, try external source
    // ID format: source:externalId (e.g., "tpdb:12345")
    const [source, externalId] = id.includes(":") ? id.split(":") : ["tpdb", id];

    // UUID validation for TPDB
    if (!this.isValidUUID(externalId)) {
      this.logger.warn({ id, externalId }, "Invalid UUID format for TPDB lookup");
      return null;
    }

    try {
      if (source === "tpdb" && this.tpdbProvider) {
        return await this.tpdbProvider.getPerformerById(externalId);
      }
    } catch (error) {
      this.logger.error(
        { error, id, externalId },
        "Failed to fetch performer from TPDB"
      );
    }

    return null;
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
