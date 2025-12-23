import type {
  TPDBConfig,
  TPDBContentType,
  TPDBResponse,
  TPDBScene,
  TPDBPerformer,
  TPDBSite,
} from "./tpdb.types.js";
import type { Gender } from "@repo/shared-types";
import { deduplicateScenes } from "../../utils/scene-deduplicator.js";

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
  async searchScenes(query: string, options?: {
    limit?: number;
    page?: number;
    contentType?: TPDBContentType;
    deduplicate?: boolean;
  }) {
    const contentType = options?.contentType || "scene";
    const endpoint = `/${contentType}s?q=${encodeURIComponent(query)}&per_page=${options?.limit || 20}&page=${options?.page || 1}`;

    const response = await this.request<TPDBResponse<TPDBScene[]>>(endpoint);
    const mappedScenes = response.data.map(s => this.mapScene(s, contentType));

    // Apply deduplication if requested (default: true)
    const shouldDeduplicate = options?.deduplicate !== false;
    return shouldDeduplicate ? deduplicateScenes(mappedScenes) : mappedScenes;
  }

  async getSceneById(id: string, contentType: TPDBContentType = "scene") {
    const endpoint = `/${contentType}s/${id}`;
    const response = await this.request<TPDBResponse<TPDBScene>>(endpoint);
    return this.mapScene(response.data, contentType);
  }

  async getSceneByHash(hash: string, _hashType: "OSHASH" | "PHASH") {
    // Try all content types
    for (const contentType of ["scene", "jav", "movie"] as TPDBContentType[]) {
      try {
        const endpoint = `/${contentType}s/hash/${hash}`;
        const response = await this.request<TPDBResponse<TPDBScene>>(endpoint);
        if (response.data) {
          return this.mapScene(response.data, contentType);
        }
      } catch (error) {
        // Continue to next content type
        continue;
      }
    }
    return null;
  }

  // Performer Methods
  async searchPerformers(query: string, limit = 20) {
    const endpoint = `/performers?q=${encodeURIComponent(query)}&per_page=${limit}`;
    const response = await this.request<TPDBResponse<TPDBPerformer[]>>(endpoint);
    return response.data.map(p => this.mapPerformer(p));
  }

  async getPerformerById(id: string) {
    const endpoint = `/performers/${id}`;
    const response = await this.request<TPDBResponse<TPDBPerformer>>(endpoint);
    return this.mapPerformer(response.data);
  }

  async getPerformerScenes(
    id: string,
    contentType?: TPDBContentType,
    page = 1,
    deduplicate = true
  ): Promise<{
    scenes: ReturnType<typeof this.mapScene>[];
    pagination?: {
      currentPage: number;
      lastPage: number;
      perPage: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    const type = contentType || "scene";
    // JAV endpoint is special: /performers/{id}/javs (not /javs)
    const endpoint = type === 'jav'
      ? `/performers/${id}/jav?page=${page}`
      : `/performers/${id}/${type}?page=${page}`;

    try {
      const response = await this.request<TPDBResponse<TPDBScene[]>>(endpoint);

      const mappedScenes = response.data.map(s => this.mapScene(s, type));

      // Apply deduplication by default
      const scenes = deduplicate ? deduplicateScenes(mappedScenes) : mappedScenes;

      // Transform pagination metadata
      let pagination;
      if (response.meta) {
        const hasMore = response.meta.current_page < response.meta.last_page;

        pagination = {
          currentPage: response.meta.current_page,
          lastPage: response.meta.last_page,
          perPage: response.meta.per_page,
          total: response.meta.total,
          hasMore,
        };

        console.log(`[TPDB] ${type}s page ${page}: ${scenes.length} scenes (${response.meta.current_page}/${response.meta.last_page} pages, ${response.meta.total} total)`);
      }

      return {
        scenes,
        pagination,
      };
    } catch (error) {
      // If 404, performer has no content of this type - return empty (this is normal)
      if (error instanceof Error && error.message.includes('404')) {
        // Only log for non-JAV types or if debugging
        if (type !== 'jav') {
          console.log(`[TPDB] No ${type}s found for performer ${id}`);
        }
        return { scenes: [] };
      }
      // Re-throw other errors
      throw error;
    }
  }

  // Site Methods (equivalent to Studios)
  async searchSites(query: string) {
    const endpoint = `/sites?q=${encodeURIComponent(query)}`;
    const response = await this.request<TPDBResponse<TPDBSite[]>>(endpoint);
    return response.data.map(s => this.mapSite(s));
  }

  async getSiteById(id: string) {
    const endpoint = `/sites/${id}`;
    const response = await this.request<TPDBResponse<TPDBSite>>(endpoint);
    return this.mapSite(response.data);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request("/scenes?per_page=1");
      return true;
    } catch {
      return false;
    }
  }

  // Mappers
  private mapScene(scene: TPDBScene, contentType: TPDBContentType) {
    // Handle posters - TPDB returns it as an object, not an array
    const posterImages: Array<{ url: string }> = [];
    if (scene.posters && typeof scene.posters === 'object') {
      if ('large' in scene.posters && scene.posters.large) {
        posterImages.push({ url: scene.posters.large });
      }
      if ('medium' in scene.posters && scene.posters.medium) {
        posterImages.push({ url: scene.posters.medium });
      }
    }

    return {
      id: String(scene.id || scene.uuid), // Ensure ID is string
      stashdbId: null, // Not from TPDB
      tpdbId: String(scene.id),
      title: scene.title,
      date: scene.date || null,
      details: scene.description || null,
      duration: scene.duration || null,
      director: scene.director || null,
      code: scene.code || null,
      tpdbContentType: contentType,
      urls: scene.url ? [scene.url] : [],
      images: [
        ...(scene.background?.full ? [{ url: scene.background.full }] : []),
        ...posterImages,
      ],
      performers:
        scene.performers?.map(p => ({
          id: String(p.id || p._id), // Ensure ID is string
          name: p.name,
          disambiguation: p.parent?.disambiguation || null,
        })) || [],
      studio: scene.site
        ? {
            id: String(scene.site.id || scene.site.uuid), // Ensure ID is string
            stashdbId: null, // Not from TPDB
            name: scene.site.name,
          }
        : null,
      tags: scene.tags?.map(t => t.name) || [],
      hashes: scene.hashes,
    };
  }

  private mapPerformer(performer: TPDBPerformer) {
    // Format body modifications to string
    const formatBodyMods = (mods?: Array<{ location: string; description?: string }>) => {
      if (!mods || mods.length === 0) return null;
      return mods
        .map((m) => `${m.location}${m.description ? `: ${m.description}` : ""}`)
        .join(", ");
    };

    // Format measurements
    const formatMeasurements = () => {
      if (!performer.measurements) return null;
      const parts = [];
      if (performer.measurements.chest) parts.push(String(performer.measurements.chest));
      if (performer.measurements.waist) parts.push(String(performer.measurements.waist));
      if (performer.measurements.hip) parts.push(String(performer.measurements.hip));
      return parts.length > 0 ? parts.join("-") : null;
    };

    // Calculate career length
    const careerLength = performer.career_start_year && performer.career_end_year
      ? `${performer.career_end_year - performer.career_start_year} years`
      : performer.career_start_year
      ? `${new Date().getFullYear() - performer.career_start_year}+ years`
      : null;

    // Handle performer posters - can be object or array
    const performerImages: Array<{ url: string }> = [];

    // Add main images first
    if (performer.image) performerImages.push({ url: performer.image });
    if (performer.thumbnail && performer.thumbnail !== performer.image) {
      performerImages.push({ url: performer.thumbnail });
    }

    // Then add posters
    if (performer.posters) {
      if (Array.isArray(performer.posters)) {
        performerImages.push(...performer.posters.map(p => ({ url: p.url })));
      } else if (typeof performer.posters === 'object') {
        if ('large' in performer.posters && performer.posters.large) {
          performerImages.push({ url: performer.posters.large });
        }
        if ('medium' in performer.posters && performer.posters.medium) {
          performerImages.push({ url: performer.posters.medium });
        }
      }
    }

    return {
      id: String(performer.id || performer._id),
      stashdbId: null,
      tpdbId: String(performer.id || performer._id),
      name: performer.name,
      aliases: performer.parent?.name ? [performer.parent.name] : [],
      disambiguation: performer.parent?.disambiguation || null,
      gender: this.mapGender(performer.extras?.gender),
      birthdate: performer.extras?.birthday || performer.birth_date || null,
      birthplace: performer.extras?.birthplace || null,
      ethnicity: performer.extras?.ethnicity || null,
      nationality: performer.extras?.nationality || null,
      hairColor: performer.extras?.hair_colour || null,
      eyeColor: performer.extras?.eye_colour || null,
      height: performer.extras?.height || null,
      weight: performer.extras?.weight || null,
      cupSize: performer.extras?.cupsize || null,
      fakeBoobs: performer.extras?.fake_boobs || false,
      deathDate: null,
      careerStartDate: performer.career_start_year ? String(performer.career_start_year) : null,
      careerEndDate: performer.career_end_year ? String(performer.career_end_year) : null,
      careerLength,
      bio: performer.bio || null,
      measurements: formatMeasurements(),
      tattoos: performer.extras?.tattoos || formatBodyMods(performer.tattoos),
      piercings: performer.extras?.piercings || formatBodyMods(performer.piercings),
      images: performerImages,
    };
  }

  private mapSite(site: TPDBSite) {
    const images: Array<{ url: string }> = [];
    if (site.logo) images.push({ url: site.logo });
    if (site.poster && site.poster !== site.logo) images.push({ url: site.poster });
    if (site.favicon && site.favicon !== site.logo) images.push({ url: site.favicon });

    return {
      id: String(site.id || site.uuid),
      stashdbId: null,
      tpdbId: String(site.id || site.uuid),
      name: site.name,
      aliases: site.short_name && site.short_name !== site.name ? [site.short_name] : [],
      parentStudioId: site.parent?.id ? String(site.parent.id) : site.parent_id ? String(site.parent_id) : null,
      parentStudioName: site.parent?.name || null,
      networkId: site.network?.id ? String(site.network.id) : site.network_id ? String(site.network_id) : null,
      networkName: site.network?.name || null,
      description: site.description || null,
      images,
      url: site.url || null,
    };
  }

  private mapGender(gender?: string): Gender | null {
    if (!gender) return null;

    const genderLower = gender.toLowerCase();
    const genderMap: Record<string, Gender> = {
      male: "male",
      female: "female",
      "trans male": "transgender_male",
      "trans female": "transgender_female",
      transgender: "transgender_female",
      intersex: "intersex",
      "non-binary": "non_binary",
      nonbinary: "non_binary",
    };

    return genderMap[genderLower] || null;
  }
}

export function createTPDBService(config: TPDBConfig) {
  return new TPDBService(config);
}
