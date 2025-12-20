import { GraphQLClient } from "graphql-request";
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

export class StashDBService {
  private client: GraphQLClient;

  constructor(config: StashDBConfig) {
    this.client = new GraphQLClient(config.apiUrl, {
      headers: config.apiKey
        ? {
            "ApiKey": config.apiKey,
          }
        : {},
    });
  }

  async searchPerformers(query: string, limit = 20) {
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

    const data = await this.client.request<SearchPerformersResponse>(
      searchQuery,
      {
        term: query,
        limit,
      }
    );

    return data.searchPerformer.map((p) => this.mapPerformer(p));
  }

  async searchStudios(query: string, limit = 20) {
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

    const data = await this.client.request<SearchStudiosResponse>(searchQuery, {
      term: query,
      limit,
    });

    return data.searchStudio.map((s) => this.mapStudio(s));
  }

  async searchScenes(query: string, limit = 20) {
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

    const data = await this.client.request<SearchScenesResponse>(searchQuery, {
      term: query,
      limit,
    });

    return data.searchScene.map((s) => this.mapScene(s));
  }

  async getPerformerDetails(id: string) {
    const query = `
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

    const data = await this.client.request<FindPerformerResponse>(query, {
      id,
    });

    return this.mapPerformer(data.findPerformer);
  }

  async getStudioDetails(id: string) {
    const query = `
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

    const data = await this.client.request<FindStudioResponse>(query, { id });

    return this.mapStudio(data.findStudio);
  }

  async getSceneById(id: string) {
    return this.getSceneDetails(id);
  }

  async getSceneDetails(id: string) {
    const query = `
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

    const data = await this.client.request<FindSceneResponse>(query, { id });

    return this.mapScene(data.findScene);
  }

  async request<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    return this.client.request<T>(query, variables);
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
      return false;
    }
  }

  private mapPerformer(performer: StashDBPerformer) {
    return {
      id: performer.id,
      stashdbId: performer.id,
      name: performer.name,
      aliases: performer.aliases || [],
      disambiguation: performer.disambiguation || null,
      gender: this.mapGender(performer.gender),
      birthdate: performer.birth_date || null,
      deathDate: performer.death_date || null,
      careerStartDate: performer.career_start_year
        ? `${performer.career_start_year}-01-01`
        : null,
      careerEndDate: performer.career_end_year
        ? `${performer.career_end_year}-12-31`
        : null,
      images:
        performer.images?.map((img) => ({
          url: img.url,
          width: img.width,
          height: img.height,
        })) || [],
    };
  }

  private mapStudio(studio: StashDBStudio) {
    return {
      id: studio.id,
      stashdbId: studio.id,
      name: studio.name,
      aliases: studio.aliases || [],
      parentStudioId: studio.parent?.id || null,
      images:
        studio.images?.map((img) => ({
          url: img.url,
          width: img.width,
          height: img.height,
        })) || [],
      url: studio.urls?.[0]?.url || null,
    };
  }

  private mapScene(scene: StashDBScene) {
    return {
      id: scene.id,
      stashdbId: scene.id,
      title: scene.title,
      date: scene.date || null,
      details: scene.details || null,
      duration: scene.duration || null,
      director: scene.director || null,
      code: scene.code || null,
      urls: scene.urls?.map((u) => u.url) || [],
      images:
        scene.images?.map((img) => ({
          url: img.url,
          width: img.width,
          height: img.height,
        })) || [],
      performers:
        scene.performers?.map((p) => ({
          id: p.performer.id,
          name: p.performer.name,
          disambiguation: p.performer.disambiguation || null,
        })) || [],
      studio: scene.studio
        ? {
            id: scene.studio.id,
            name: scene.studio.name,
          }
        : null,
      tags: scene.tags?.map((t) => t.name) || [],
    };
  }

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

// Export factory function
export function createStashDBService(config: StashDBConfig) {
  return new StashDBService(config);
}
