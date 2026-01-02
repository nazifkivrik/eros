import type { Logger } from "pino";
import { SearchService } from "../../application/services/search.service.js";
import { SearchQuerySchema } from "../../modules/search/search.schema.js";

/**
 * Search Controller
 * Handles HTTP request/response for search endpoints
 * Responsibilities:
 * - Request validation (Zod)
 * - Calling service methods
 * - Error handling (404s)
 * - Response formatting
 */
export class SearchController {
  private searchService: SearchService;
  private logger: Logger;

  constructor({
    searchService,
    logger,
  }: {
    searchService: SearchService;
    logger: Logger;
  }) {
    this.searchService = searchService;
    this.logger = logger;
  }

  /**
   * Search all entities (performers, studios, scenes)
   */
  async searchAll(body: unknown) {
    const validated = SearchQuerySchema.parse(body);

    try {
      const results = await this.searchService.searchAll(
        validated.query,
        validated.limit,
        validated.page
      );

      return results;
    } catch (error) {
      this.logger.error({ error, query: validated.query }, "Search failed");
      throw error;
    }
  }

  /**
   * Search performers only
   */
  async searchPerformers(body: unknown) {
    const validated = SearchQuerySchema.parse(body);
    const results = await this.searchService.searchPerformers(
      validated.query,
      validated.limit,
      validated.page
    );

    return { results };
  }

  /**
   * Search studios only
   */
  async searchStudios(body: unknown) {
    const validated = SearchQuerySchema.parse(body);
    const results = await this.searchService.searchStudios(
      validated.query,
      validated.limit,
      validated.page
    );

    return { results };
  }

  /**
   * Search scenes only
   */
  async searchScenes(body: unknown) {
    const validated = SearchQuerySchema.parse(body);
    const results = await this.searchService.searchScenes(
      validated.query,
      validated.limit,
      validated.page
    );

    return { results };
  }

  /**
   * Get performer details by ID
   */
  async getPerformerDetails(params: { id: string }) {
    const performer = await this.searchService.getPerformerDetails(params.id);

    if (!performer) {
      throw new Error("Performer not found");
    }

    return performer;
  }

  /**
   * Get studio details by ID
   */
  async getStudioDetails(params: { id: string }) {
    const studio = await this.searchService.getStudioDetails(params.id);

    if (!studio) {
      throw new Error("Studio not found");
    }

    return studio;
  }

  /**
   * Get scene details by ID
   */
  async getSceneDetails(params: { id: string }) {
    const scene = await this.searchService.getSceneDetails(params.id);

    if (!scene) {
      throw new Error("Scene not found");
    }

    return scene;
  }
}
