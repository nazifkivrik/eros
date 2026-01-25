/**
 * TPDB (ThePornDB) Adapter
 * Implements IMetadataProvider interface for ThePornDB REST API
 */

import type {
  IMetadataProvider,
  MetadataPerformer,
  MetadataStudio,
  MetadataScene,
  MetadataImage,
} from "./interfaces/metadata-provider.interface.js";
import type { Logger } from "pino";
import type {
  TPDBPerformer,
  TPDBScene,
  TPDBSite,
  TPDBPaginatedResponse,
  TPDBSingleResponse,
} from "@repo/shared-types";

interface TPDBConfig {
  apiUrl: string;
  apiKey: string;
}

type TPDBContentType = "scene" | "jav" | "movie";

/**
 * Internal Scene type from TPDB (includes hashes for deduplication)
 */
interface TPDBSceneWithHashes extends Omit<TPDBScene, "hashes"> {
  hashes?: Array<{ hash: string; type: string }>;
}

export class TPDBAdapter implements IMetadataProvider {
  readonly name = "tpdb";
  private baseUrl: string;
  private apiKey: string;
  private logger: Logger;

  constructor(config: TPDBConfig, logger: Logger) {
    this.baseUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.logger = logger;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`TPDB API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as T;
  }

  async searchPerformers(query: string, limit: number = 20): Promise<MetadataPerformer[]> {
    const endpoint = `/performers?q=${encodeURIComponent(query)}&per_page=${limit}`;
    const response = await this.request<TPDBPaginatedResponse<TPDBPerformer>>(endpoint);

    this.logger.debug({ count: response.data.length, query }, "TPDB performer search completed");

    return response.data.map((p) => this.mapPerformerToInterface(p));
  }

  async getPerformerById(id: string): Promise<MetadataPerformer | null> {
    try {
      const endpoint = `/performers/${id}`;
      const response = await this.request<TPDBSingleResponse<TPDBPerformer>>(endpoint);
      return this.mapPerformerToInterface(response.data);
    } catch (error) {
      this.logger.error({ error, id }, "TPDB performer lookup failed");
      return null;
    }
  }

  async searchStudios(query: string, _limit: number = 20): Promise<MetadataStudio[]> {
    const endpoint = `/sites?q=${encodeURIComponent(query)}`;
    const response = await this.request<TPDBPaginatedResponse<TPDBSite>>(endpoint);

    this.logger.debug({ count: response.data.length, query }, "TPDB studio search completed");

    return response.data.map((s) => this.mapStudioToInterface(s));
  }

  async getStudioById(id: string): Promise<MetadataStudio | null> {
    try {
      const endpoint = `/sites/${id}`;
      const response = await this.request<TPDBSingleResponse<TPDBSite>>(endpoint);
      return this.mapStudioToInterface(response.data);
    } catch (error) {
      this.logger.error({ error, id }, "TPDB studio lookup failed");
      return null;
    }
  }

  async searchScenes(
    query: string,
    limit: number = 20,
    page: number = 1
  ): Promise<MetadataScene[]> {
    const contentType = "scene";
    const endpoint = `/${contentType}s?q=${encodeURIComponent(query)}&per_page=${limit}&page=${page}`;
    const response = await this.request<TPDBPaginatedResponse<TPDBScene>>(endpoint);

    this.logger.debug({ count: response.data.length, query, page }, "TPDB scene search completed");

    return response.data.map((s) => this.mapSceneToInterface(s));
  }

  async getSceneById(id: string): Promise<MetadataScene | null> {
    try {
      const endpoint = `/scenes/${id}`;
      const response = await this.request<TPDBSingleResponse<TPDBScene>>(endpoint);
      return this.mapSceneToInterface(response.data);
    } catch (error) {
      this.logger.error({ error, id }, "TPDB scene lookup failed");
      return null;
    }
  }

  async getSceneByHash(
    hash: string,
    hashType: "OSHASH" | "PHASH"
  ): Promise<MetadataScene | null> {
    // Try all content types
    for (const contentType of ["scene", "jav", "movie"] as TPDBContentType[]) {
      try {
        const endpoint = `/${contentType}s/hash/${hash}`;
        const response = await this.request<TPDBSingleResponse<TPDBScene>>(endpoint);
        if (response.data) {
          this.logger.debug({ hash, hashType, contentType }, "TPDB hash lookup successful");
          return this.mapSceneToInterface(response.data);
        }
      } catch (error) {
        // Continue to next content type
        continue;
      }
    }
    this.logger.debug({ hash, hashType }, "TPDB hash lookup failed - not found");
    return null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request("/scenes?per_page=1");
      return true;
    } catch (error) {
      this.logger.error({ error }, "TPDB connection test failed");
      return false;
    }
  }

  /**
   * Search for sites (studios in TPDB terminology)
   * This is an alias for searchStudios with pagination support
   */
  async searchSites(
    query: string,
    page: number = 1
  ): Promise<{
    sites: MetadataStudio[];
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
    };
  }> {
    const perPage = 25;
    const endpoint = `/sites?search=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
    const response = await this.request<TPDBPaginatedResponse<TPDBSite>>(endpoint);

    const sites = (response.data || []).map((studio) =>
      this.mapStudioToInterface(studio)
    );

    return {
      sites,
      pagination: response.meta
        ? {
            total: response.meta.total,
            page: response.meta.current_page,
            pageSize: response.meta.per_page,
          }
        : undefined,
    };
  }

  /**
   * Get scenes for a specific performer (TPDB-specific method)
   */
  async getPerformerScenes(
    performerId: string,
    contentType: TPDBContentType = "scene",
    page: number = 1
  ): Promise<{
    scenes: MetadataScene[];
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
    };
  }> {
    const perPage = 25;
    const endpoint = `/performers/${performerId}/${contentType}s?page=${page}&per_page=${perPage}`;

    try {
      const response = await this.request<TPDBPaginatedResponse<TPDBScene>>(endpoint);

      const scenes = response.data.map((s) => this.mapSceneToInterface(s));

      let pagination;
      if (response.meta) {
        pagination = {
          total: response.meta.total,
          page: response.meta.current_page,
          pageSize: response.meta.per_page,
        };

        this.logger.info(
          `[TPDB] ${contentType}s page ${page}: ${scenes.length} scenes (${response.meta.current_page}/${response.meta.last} pages, ${response.meta.total} total)`
        );
      }

      return { scenes, pagination };
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        this.logger.info(`[TPDB] No ${contentType}s found for performer ${performerId}`);
        return { scenes: [] };
      }
      throw error;
    }
  }

  /**
   * Map TPDB performer to IMetadataProvider format
   */
  private mapPerformerToInterface(tpdb: TPDBPerformer): MetadataPerformer {
    const images: MetadataImage[] = [];
    if (tpdb.posters && tpdb.posters.length > 0) {
      images.push(
        ...tpdb.posters.map((p) => ({
          id: tpdb.id,
          url: p.url,
          width: 0,
          height: 0,
        }))
      );
    }

    return {
      id: tpdb.id,
      name: tpdb.name,
      disambiguation: tpdb.disambiguation ?? undefined,
      aliases: tpdb.aliases || [],
      gender: tpdb.extras?.gender ?? undefined,
      birthDate: tpdb.extras?.birthday ?? undefined,
      deathDate: tpdb.extras?.deathday ?? undefined,
      careerStartYear: tpdb.extras?.career_start_year ?? undefined,
      careerEndYear: tpdb.extras?.career_end_year ?? undefined,
      images,
      // Additional fields from TPDB extras
      birthplace: tpdb.extras?.birthplace ?? undefined,
      birthplaceCode: tpdb.extras?.birthplace_code ?? undefined,
      astrology: tpdb.extras?.astrology ?? undefined,
      ethnicity: tpdb.extras?.ethnicity ?? undefined,
      nationality: tpdb.extras?.nationality ?? undefined,
      hairColour: tpdb.extras?.hair_colour ?? undefined,
      eyeColour: tpdb.extras?.eye_colour ?? undefined,
      height: tpdb.extras?.height ?? undefined,
      weight: tpdb.extras?.weight ?? undefined,
      measurements: tpdb.extras?.measurements ?? undefined,
      cupsize: tpdb.extras?.cupsize ?? undefined,
      waist: tpdb.extras?.waist ?? undefined,
      hips: tpdb.extras?.hips ?? undefined,
      tattoos: tpdb.extras?.tattoos ?? undefined,
      piercings: tpdb.extras?.piercings ?? undefined,
      fakeBoobs: tpdb.extras?.fake_boobs ?? undefined,
      sameSexOnly: tpdb.extras?.same_sex_only ?? undefined,
      bio: tpdb.bio ?? undefined,
      links: tpdb.extras?.links && Array.isArray(tpdb.extras.links) ? Object.fromEntries(
        tpdb.extras.links.map((l: any) => [l.url || l.platform, l.url])
      ) : undefined,
    };
  }

  /**
   * Map TPDB site/studio to IMetadataProvider format
   */
  private mapStudioToInterface(tpdb: TPDBSite): MetadataStudio {
    const images: MetadataImage[] = [];
    if (tpdb.poster) {
      images.push({ id: tpdb.uuid, url: tpdb.poster, width: 0, height: 0 });
    }
    if (tpdb.logo) {
      images.push({ id: `${tpdb.uuid}-logo`, url: tpdb.logo, width: 0, height: 0 });
    }

    return {
      id: tpdb.uuid,
      name: tpdb.name,
      aliases: [],
      parent: undefined,
      urls: tpdb.url ? [{ url: tpdb.url, site: { name: tpdb.name } }] : [],
      images,
    };
  }

  /**
   * Map TPDB scene to IMetadataProvider format
   */
  private mapSceneToInterface(tpdb: TPDBScene): MetadataScene {
    const images: MetadataImage[] = [];
    if (tpdb.poster) {
      images.push({ id: `${tpdb.id}-poster`, url: tpdb.poster, width: 0, height: 0 });
    }
    if (tpdb.background?.large) {
      images.push({ id: `${tpdb.id}-bg`, url: tpdb.background.large, width: 0, height: 0 });
    }

    const directorIds =
      tpdb.directors && tpdb.directors.length > 0 ? tpdb.directors.map((d) => d.uuid) : [];

    // Extract hashes for deduplication
    const hashes =
      tpdb.hashes && tpdb.hashes.length > 0
        ? tpdb.hashes.map((h) => ({ hash: h.hash, type: h.type }))
        : [];

    return {
      id: tpdb.id,
      title: tpdb.title,
      date: tpdb.date,
      details: tpdb.description,
      duration: tpdb.duration,
      director: tpdb.directors?.[0]?.name,
      code: tpdb.sku,
      urls: tpdb.url ? [{ url: tpdb.url, site: { name: tpdb.site?.name || "unknown" } }] : [],
      images,
      performers:
        tpdb.performers?.map((p) => ({
          performer: {
            id: p.id,
            name: p.name,
            disambiguation: p.disambiguation,
            aliases: p.aliases || [],
            gender: p.extras?.gender,
            birthDate: p.extras?.birthday,
            deathDate: p.extras?.deathday,
            careerStartYear: p.extras?.career_start_year,
            careerEndYear: p.extras?.career_end_year,
            images: [],
          },
        })) || [],
      studio: tpdb.site
        ? {
            id: tpdb.site.uuid,
            name: tpdb.site.name,
            aliases: [],
            parent: undefined,
            urls: tpdb.site.url ? [{ url: tpdb.site.url, site: { name: tpdb.site.name } }] : [],
            images: [],
          }
        : undefined,
      tags: tpdb.tags?.map((t) => ({ name: t.name })) || [],
      // Include extra properties for internal use
      contentType: tpdb.type?.toLowerCase() as any,
      hashes,
    } as any; // Type assertion for extra properties
  }

  /**
   * Helper to map image to interface format
   */
  private mapImage(img: { url: string; id?: string }): MetadataImage {
    return {
      id: img.id || img.url,
      url: img.url,
      width: 0,
      height: 0,
    };
  }
}

/**
 * Factory function to create TPDBAdapter
 */
export function createTPDBAdapter(config: {
  apiUrl: string;
  apiKey: string;
}, logger: Logger): TPDBAdapter {
  return new TPDBAdapter(config, logger);
}
