/**
 * StashDB Adapter
 * Implements IMetadataProvider interface for StashDB GraphQL API
 */

import { GraphQLClient } from "graphql-request";
import type {
  IMetadataProvider,
  MetadataPerformer,
  MetadataStudio,
  MetadataScene,
  MetadataImage,
} from "./interfaces/metadata-provider.interface.js";
import type { Logger } from "pino";
import type { Gender } from "@repo/shared-types";

interface StashDBConfig {
  apiUrl: string;
  apiKey?: string;
}

interface StashDBImage {
  id: string;
  url: string;
  width: number;
  height: number;
}

interface StashDBPerformer {
  id: string;
  name: string;
  disambiguation?: string;
  aliases: string[];
  gender?: string;
  birth_date?: string;
  death_date?: string;
  career_start_year?: number;
  career_end_year?: number;
  images: StashDBImage[];
}

interface StashDBStudio {
  id: string;
  name: string;
  aliases: string[];
  parent?: {
    id: string;
    name: string;
  };
  urls: Array<{ url: string; site: { name: string } }>;
  images: StashDBImage[];
}

interface StashDBScene {
  id: string;
  title: string;
  date?: string;
  details?: string;
  duration?: number;
  director?: string;
  code?: string;
  urls: Array<{ url: string; site: { name: string } }>;
  images: StashDBImage[];
  performers: Array<{
    performer: StashDBPerformer;
  }>;
  studio?: StashDBStudio;
  tags: Array<{
    name: string;
  }>;
}

interface SearchPerformersResponse {
  searchPerformer: StashDBPerformer[];
}

interface SearchStudiosResponse {
  searchStudio: StashDBStudio[];
}

interface SearchScenesResponse {
  searchScene: StashDBScene[];
}

interface FindPerformerResponse {
  findPerformer: StashDBPerformer;
}

interface FindStudioResponse {
  findStudio: StashDBStudio;
}

interface FindSceneResponse {
  findScene: StashDBScene;
}

export class StashDBAdapter implements IMetadataProvider {
  readonly name = "stashdb";
  private client: GraphQLClient;
  private logger: Logger;

  constructor(config: StashDBConfig, logger: Logger) {
    this.client = new GraphQLClient(config.apiUrl, {
      headers: config.apiKey
        ? {
            "ApiKey": config.apiKey,
          }
        : {},
    });
    this.logger = logger;
  }

  private async request<T = unknown>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    return this.client.request<T>(query, variables);
  }

  async searchPerformers(query: string, limit: number = 20): Promise<MetadataPerformer[]> {
    const searchQuery = `
      query SearchPerformers($term: String!, $limit: Int!) {
        searchPerformer(term: $term, limit: $limit) {
          id
          name
          disambiguation
          aliases
          gender
          birth_date
          death_date
          career_start_year
          career_end_year
          images {
            id
            url
            width
            height
          }
        }
      }
    `;

    const data = await this.request<SearchPerformersResponse>(searchQuery, {
      term: query,
      limit,
    });

    this.logger.debug({ count: data.searchPerformer.length, query }, "StashDB performer search completed");

    return data.searchPerformer.map((p) => this.mapPerformerToInterface(p));
  }

  async getPerformerById(id: string): Promise<MetadataPerformer | null> {
    try {
      const performerQuery = `
        query FindPerformer($id: ID!) {
          findPerformer(id: $id) {
            id
            name
            disambiguation
            aliases
            gender
            birth_date
            death_date
            career_start_year
            career_end_year
            images {
              id
              url
              width
              height
            }
          }
        }
      `;

      const data = await this.request<FindPerformerResponse>(performerQuery, { id });
      if (!data.findPerformer) {
        this.logger.warn({ id }, "StashDB performer not found");
        return null;
      }
      return this.mapPerformerToInterface(data.findPerformer);
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error), id }, "StashDB performer lookup failed");
      return null;
    }
  }

  async searchStudios(query: string, limit: number = 20): Promise<MetadataStudio[]> {
    const searchQuery = `
      query SearchStudios($term: String!, $limit: Int!) {
        searchStudio(term: $term, limit: $limit) {
          id
          name
          aliases
          parent {
            id
            name
          }
          urls {
            url
            site {
              name
            }
          }
          images {
            id
            url
            width
            height
          }
        }
      }
    `;

    const data = await this.request<SearchStudiosResponse>(searchQuery, {
      term: query,
      limit,
    });

    this.logger.debug({ count: data.searchStudio.length, query }, "StashDB studio search completed");

    return data.searchStudio.map((s) => this.mapStudioToInterface(s));
  }

  async getStudioById(id: string): Promise<MetadataStudio | null> {
    try {
      const studioQuery = `
        query FindStudio($id: ID!) {
          findStudio(id: $id) {
            id
            name
            aliases
            parent {
              id
              name
            }
            urls {
              url
              site {
                name
              }
            }
            images {
              id
              url
              width
              height
            }
          }
        }
      `;

      const data = await this.request<FindStudioResponse>(studioQuery, { id });
      return this.mapStudioToInterface(data.findStudio);
    } catch (error) {
      this.logger.error({ error, id }, "StashDB studio lookup failed");
      return null;
    }
  }

  async searchScenes(
    query: string,
    limit: number = 20,
    _page: number = 1
  ): Promise<MetadataScene[]> {
    const searchQuery = `
      query SearchScenes($term: String!, $limit: Int!) {
        searchScene(term: $term, limit: $limit) {
          id
          title
          date
          details
          duration
          director
          code
          urls {
            url
            site {
              name
            }
          }
          images {
            id
            url
            width
            height
          }
          performers {
            performer {
              id
              name
              disambiguation
            }
          }
          studio {
            id
            name
          }
          tags {
            name
          }
        }
      }
    `;

    const data = await this.request<SearchScenesResponse>(searchQuery, {
      term: query,
      limit,
    });

    this.logger.debug({ count: data.searchScene.length, query }, "StashDB scene search completed");

    return data.searchScene.map((s) => this.mapSceneToInterface(s));
  }

  async getSceneById(id: string): Promise<MetadataScene | null> {
    try {
      const sceneQuery = `
        query FindScene($id: ID!) {
          findScene(id: $id) {
            id
            title
            date
            details
            duration
            director
            code
            urls {
              url
              site {
                name
              }
            }
            images {
              id
              url
              width
              height
            }
            performers {
              performer {
                id
                name
                disambiguation
                gender
                birth_date
                career_start_year
                career_end_year
              }
            }
            studio {
              id
              name
            }
            tags {
              name
            }
          }
        }
      `;

      const data = await this.request<FindSceneResponse>(sceneQuery, { id });
      return this.mapSceneToInterface(data.findScene);
    } catch (error) {
      this.logger.error({ error, id }, "StashDB scene lookup failed");
      return null;
    }
  }

  async getSceneByHash(
    _hash: string,
    _hashType: "OSHASH" | "PHASH"
  ): Promise<MetadataScene | null> {
    // StashDB doesn't support hash-based lookup
    return null;
  }

  async testConnection(): Promise<boolean> {
    try {
      const query = `
        query {
          __schema {
            queryType {
              name
            }
          }
        }
      `;
      await this.client.request(query);
      return true;
    } catch (error) {
      this.logger.error({ error }, "StashDB connection test failed");
      return false;
    }
  }

  /**
   * Search for sites (studios in StashDB terminology)
   * This is an alias for searchStudios with pagination support
   */
  async searchSites(
    query: string,
    _page: number = 1
  ): Promise<{
    sites: MetadataStudio[];
  }> {
    // StashDB doesn't have pagination in the same way
    // Just use searchStudios with a higher limit
    const studios = await this.searchStudios(query, 100);
    return { sites: studios };
  }

  /**
   * Map StashDB performer to IMetadataProvider format
   */
  private mapPerformerToInterface(performer: StashDBPerformer): MetadataPerformer {
    return {
      id: performer.id,
      name: performer.name,
      disambiguation: performer.disambiguation ?? undefined,
      aliases: performer.aliases,
      gender: this.mapGender(performer.gender) ?? undefined,
      birthDate: performer.birth_date ?? undefined,
      deathDate: performer.death_date ?? undefined,
      careerStartYear: performer.career_start_year ?? undefined,
      careerEndYear: performer.career_end_year ?? undefined,
      images: performer.images.map((img) => this.mapImageToInterface(img)),
    };
  }

  /**
   * Map StashDB studio to IMetadataProvider format
   */
  private mapStudioToInterface(studio: StashDBStudio): MetadataStudio {
    return {
      id: studio.id,
      name: studio.name,
      aliases: studio.aliases,
      parent: studio.parent
        ? {
            id: studio.parent.id,
            name: studio.parent.name,
          }
        : undefined,
      urls: studio.urls?.map((u) => ({
        url: u.url,
        site: { name: typeof u.site === 'string' ? u.site : (u.site?.name || studio.name) }
      })) || [],
      images: studio.images.map((img) => this.mapImageToInterface(img)),
    };
  }

  /**
   * Map StashDB scene to IMetadataProvider format
   */
  private mapSceneToInterface(scene: StashDBScene): MetadataScene {
    return {
      id: scene.id,
      title: scene.title,
      date: scene.date,
      details: scene.details,
      duration: scene.duration,
      director: scene.director,
      code: scene.code,
      urls: scene.urls?.map((u) => ({
        url: u.url,
        site: { name: typeof u.site === 'string' ? u.site : (u.site?.name || scene.studio?.name || "Unknown") }
      })) || [],
      images: scene.images?.map((img) => this.mapImageToInterface(img)) || [],
      performers:
        scene.performers?.map((p) => ({
          performer: {
            id: p.performer.id,
            name: p.performer.name,
            disambiguation: p.performer.disambiguation ?? undefined,
            aliases: [],
            gender: this.mapGender(p.performer.gender) ?? undefined,
            birthDate: p.performer.birth_date ?? undefined,
            deathDate: p.performer.death_date ?? undefined,
            careerStartYear: p.performer.career_start_year ?? undefined,
            careerEndYear: p.performer.career_end_year ?? undefined,
            images: [],
          },
        })) || [],
      studio: scene.studio
        ? {
            id: scene.studio.id,
            name: scene.studio.name,
            aliases: [],
            parent: undefined,
            urls: [],
            images: [],
          }
        : undefined,
      tags: scene.tags?.map((t) => ({ name: t.name })) || [],
    };
  }

  /**
   * Map StashDB image to IMetadataProvider format
   */
  private mapImageToInterface(img: StashDBImage): MetadataImage {
    return {
      id: img.id,
      url: img.url,
      width: img.width,
      height: img.height,
    };
  }

  /**
   * Map StashDB gender string to Gender enum
   */
  private mapGender(gender?: string): Gender | null {
    if (!gender) return null;

    const genderMap: Record<string, Gender> = {
      MALE: "male",
      FEMALE: "female",
      TRANSGENDER_MALE: "transgender_male",
      TRANSGENDER_FEMALE: "transgender_female",
      INTERSEX: "intersex",
      NON_BINARY: "non_binary",
    };

    return genderMap[gender] || null;
  }
}

/**
 * Factory function to create StashDBAdapter
 */
export function createStashDBAdapter(config: {
  apiUrl: string;
  apiKey?: string;
}, logger: Logger): StashDBAdapter {
  return new StashDBAdapter(config, logger);
}
