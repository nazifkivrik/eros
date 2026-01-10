import type {
  TPDBPerformer,
  TPDBScene,
  TPDBSite,
  TPDBPaginatedResponse,
  TPDBSingleResponse,
} from "@repo/shared-types";
import type { Performer, Scene, Studio } from "@repo/shared-types";
import {
  mapTPDBPerformerToPerformer,
  mapTPDBSceneToScene,
  mapTPDBSiteToStudio,
} from "./tpdb.mappers.js";
import { logger } from "../../utils/logger.js";

export type TPDBConfig = {
  apiUrl: string;
  apiKey: string;
};

export type TPDBContentType = "scene" | "jav" | "movie";

export class TPDBService {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: TPDBConfig) {
    this.baseUrl = config.apiUrl;
    this.apiKey = config.apiKey;
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

  // Scene Methods
  async searchScenes(
    query: string,
    options?: {
      limit?: number;
      page?: number;
      contentType?: TPDBContentType;
    }
  ): Promise<Omit<Scene, "createdAt" | "updatedAt">[]> {
    const contentType = options?.contentType || "scene";
    const endpoint = `/${contentType}s?q=${encodeURIComponent(query)}&per_page=${
      options?.limit || 20
    }&page=${options?.page || 1}`;

    const response = await this.request<TPDBPaginatedResponse<TPDBScene>>(endpoint);
    return response.data.map((scene) => mapTPDBSceneToScene(scene));
  }

  async getSceneById(
    id: string,
    contentType: TPDBContentType = "scene"
  ): Promise<Omit<Scene, "createdAt" | "updatedAt">> {
    const endpoint = `/${contentType}s/${id}`;
    const response = await this.request<TPDBSingleResponse<TPDBScene>>(endpoint);
    return mapTPDBSceneToScene(response.data);
  }

  async getSceneByHash(hash: string, _hashType: "OSHASH" | "PHASH"): Promise<Omit<Scene, "createdAt" | "updatedAt"> | null> {
    // Try all content types
    for (const contentType of ["scene", "jav", "movie"] as TPDBContentType[]) {
      try {
        const endpoint = `/${contentType}s/hash/${hash}`;
        const response = await this.request<TPDBSingleResponse<TPDBScene>>(endpoint);
        if (response.data) {
          return mapTPDBSceneToScene(response.data);
        }
      } catch (error) {
        // Continue to next content type
        continue;
      }
    }
    return null;
  }

  // Performer Methods
  async searchPerformers(
    query: string,
    limit = 20
  ): Promise<Omit<Performer, "createdAt" | "updatedAt">[]> {
    const endpoint = `/performers?q=${encodeURIComponent(query)}&per_page=${limit}`;
    const response = await this.request<TPDBPaginatedResponse<TPDBPerformer>>(endpoint);
    return response.data.map((performer) => mapTPDBPerformerToPerformer(performer));
  }

  async getPerformerById(id: string): Promise<Omit<Performer, "createdAt" | "updatedAt">> {
    const endpoint = `/performers/${id}`;
    const response = await this.request<TPDBSingleResponse<TPDBPerformer>>(endpoint);
    return mapTPDBPerformerToPerformer(response.data);
  }

  async getPerformerScenes(
    id: string,
    contentType?: TPDBContentType,
    page = 1
  ): Promise<{
    scenes: Omit<Scene, "createdAt" | "updatedAt">[];
    pagination?: {
      currentPage: number;
      lastPage: number;
      perPage: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    const type = contentType || "scene";
    // TPDB uses plural endpoints: /performers/{id}/scenes, /performers/{id}/javs, /performers/{id}/movies
    const perPage = 25;
    const endpoint = `/performers/${id}/${type}s?page=${page}&per_page=${perPage}`;

    try {
      const response = await this.request<TPDBPaginatedResponse<TPDBScene>>(endpoint);

      const scenes = response.data.map((scene) => mapTPDBSceneToScene(scene));

      // Transform pagination metadata
      let pagination;
      if (response.meta) {
        const hasMore = response.meta.current_page < response.meta.last;

        pagination = {
          currentPage: response.meta.current_page,
          lastPage: response.meta.last,
          perPage: response.meta.per_page,
          total: response.meta.total,
          hasMore,
        };

        logger.info(
          `[TPDB] ${type}s page ${page}: ${scenes.length} scenes (${response.meta.current_page}/${response.meta.last} pages, ${response.meta.total} total, hasMore=${hasMore})`
        );
      } else {
        // No pagination metadata - log this for debugging
        logger.info(
          `[TPDB] ${type}s page ${page}: ${scenes.length} scenes (NO pagination metadata in response)`
        );
      }

      return {
        scenes,
        pagination,
      };
    } catch (error) {
      // If 404, performer has no content of this type - return empty (this is normal)
      if (error instanceof Error && error.message.includes("404")) {
        // Only log for non-JAV types or if debugging
        if (type !== "jav") {
          logger.info(`[TPDB] No ${type}s found for performer ${id}`);
        }
        return { scenes: [] };
      }
      // Re-throw other errors
      throw error;
    }
  }

  // Site Methods (equivalent to Studios)
  async searchSites(query: string): Promise<Omit<Studio, "createdAt" | "updatedAt">[]> {
    const endpoint = `/sites?q=${encodeURIComponent(query)}`;
    const response = await this.request<TPDBPaginatedResponse<TPDBSite>>(endpoint);
    return response.data.map((site) => mapTPDBSiteToStudio(site));
  }

  async getSiteById(id: string): Promise<Omit<Studio, "createdAt" | "updatedAt">> {
    const endpoint = `/sites/${id}`;
    const response = await this.request<TPDBSingleResponse<TPDBSite>>(endpoint);
    return mapTPDBSiteToStudio(response.data);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request("/scenes?per_page=1");
      return true;
    } catch {
      return false;
    }
  }
}

export function createTPDBService(config: TPDBConfig) {
  return new TPDBService(config);
}
