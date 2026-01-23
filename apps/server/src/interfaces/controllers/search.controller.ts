import type { Logger } from "pino";
import { SearchService } from "../../application/services/search.service.js";
import type {
  MetadataStudio,
  MetadataPerformer,
  MetadataScene,
} from "../../infrastructure/adapters/interfaces/metadata-provider.interface.js";
import {
  SearchQuerySchema,
  StudioSchema,
  PerformerSchema,
  SceneSchema,
} from "@repo/shared-types";

/**
 * Search Controller
 * Handles HTTP request/response for search endpoints
 * Responsibilities:
 * - Request validation (Zod)
 * - Calling service methods
 * - Error handling (404s)
 * - Response formatting
 * - Mapping from MetadataProvider types to API schema types
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
   * Map MetadataStudio to StudioSchema format
   */
  private mapStudioToSchema(studio: MetadataStudio): z.infer<typeof StudioSchema> {
    return {
      id: studio.id,
      externalIds: [{ source: "tpdb", id: studio.id }],
      name: studio.name,
      shortName: null,
      slug: null,
      url: studio.urls?.[0]?.url || null,
      description: null,
      rating: 0,
      parentStudioId: studio.parent?.id || null,
      networkId: null,
      images: studio.images.map((img) => ({ url: img.url, width: img.width, height: img.height })),
      logo: null,
      favicon: null,
      poster: null,
      links: null,
    };
  }

  /**
   * Map MetadataPerformer to PerformerSchema format
   */
  private mapPerformerToSchema(performer: MetadataPerformer): z.infer<typeof PerformerSchema> {
    return {
      id: performer.id,
      externalIds: [{ source: "tpdb", id: performer.id }],
      slug: performer.id,
      name: performer.name,
      fullName: performer.name,
      disambiguation: performer.disambiguation || null,
      bio: performer.bio || null,
      rating: 0,
      aliases: performer.aliases || [],
      gender: performer.gender || null,
      birthdate: performer.birthDate || null,
      deathDate: performer.deathDate || null,
      birthplace: performer.birthplace || null,
      birthplaceCode: performer.birthplaceCode || null,
      astrology: performer.astrology || null,
      ethnicity: performer.ethnicity || null,
      nationality: performer.nationality || null,
      hairColour: performer.hairColour || null,
      eyeColour: performer.eyeColour || null,
      height: performer.height || null,
      weight: performer.weight || null,
      measurements: performer.measurements || null,
      cupsize: performer.cupsize || null,
      waist: performer.waist || null,
      hips: performer.hips || null,
      tattoos: performer.tattoos || null,
      piercings: performer.piercings || null,
      fakeBoobs: performer.fakeBoobs ?? false,
      careerStartYear: performer.careerStartYear || null,
      careerEndYear: performer.careerEndYear || null,
      sameSexOnly: performer.sameSexOnly ?? false,
      images: performer.images.map((img) => ({ url: img.url, width: img.width, height: img.height })),
      thumbnail: null,
      poster: null,
      links: performer.links || null,
    };
  }

  /**
   * Map MetadataScene to SceneSchema format
   */
  private mapSceneToSchema(scene: MetadataScene): z.infer<typeof SceneSchema> {
    const background = scene.images.find((img) => img.url.includes("background"));
    return {
      id: scene.id,
      externalIds: [{ source: "tpdb", id: scene.id }],
      slug: scene.id,
      title: scene.title,
      description: scene.details || null,
      date: scene.date || null,
      contentType: scene.contentType || "scene",
      duration: scene.duration || null,
      format: null,
      externalId: null,
      code: scene.code || null,
      sku: null,
      url: scene.urls?.[0]?.url || null,
      images: scene.images.map((img) => ({ url: img.url, width: img.width, height: img.height })),
      poster: null,
      backImage: null,
      thumbnail: null,
      trailer: null,
      background: background
        ? { full: background.url, large: background.url, medium: background.url, small: background.url }
        : null,
      rating: 0,
      siteId: scene.studio?.id || null,
      directorIds: scene.director ? [scene.director] : [],
      links: null,
      hasMetadata: false,
      inferredFromIndexers: false,
    };
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

      // Map MetadataProvider types to API schema types
      return {
        performers: results.performers.map((p) => this.mapPerformerToSchema(p)),
        studios: results.studios.map((s) => this.mapStudioToSchema(s)),
        scenes: results.scenes.map((sc) => this.mapSceneToSchema(sc)),
      };
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

    return { results: results.map((p) => this.mapPerformerToSchema(p)) };
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

    return { results: results.map((s) => this.mapStudioToSchema(s)) };
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

    return { results: results.map((sc) => this.mapSceneToSchema(sc)) };
  }

  /**
   * Get performer details by ID
   */
  async getPerformerDetails(params: { id: string }) {
    const performer = await this.searchService.getPerformerDetails(params.id);

    if (!performer) {
      throw new Error("Performer not found");
    }

    return this.mapPerformerToSchema(performer);
  }

  /**
   * Get studio details by ID
   */
  async getStudioDetails(params: { id: string }) {
    const studio = await this.searchService.getStudioDetails(params.id);

    if (!studio) {
      throw new Error("Studio not found");
    }

    return this.mapStudioToSchema(studio);
  }

  /**
   * Get scene details by ID
   */
  async getSceneDetails(params: { id: string }) {
    const scene = await this.searchService.getSceneDetails(params.id);

    if (!scene) {
      throw new Error("Scene not found");
    }

    return this.mapSceneToSchema(scene);
  }
}
