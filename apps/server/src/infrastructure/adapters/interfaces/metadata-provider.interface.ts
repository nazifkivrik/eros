/**
 * IMetadataProvider Interface
 * Abstraction for metadata provider services (TPDB, StashDB, etc.)
 * Allows swapping metadata providers without changing business logic
 */

export interface MetadataImage {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface MetadataPerformer {
  id: string;
  name: string;
  disambiguation?: string;
  aliases: string[];
  gender?: string;
  birthDate?: string;
  deathDate?: string;
  careerStartYear?: number;
  careerEndYear?: number;
  images: MetadataImage[];

  // Additional fields from TPDB extras
  birthplace?: string;
  birthplaceCode?: string;
  astrology?: string;
  ethnicity?: string;
  nationality?: string;
  hairColour?: string;
  eyeColour?: string;
  height?: string;
  weight?: string;
  measurements?: string;
  cupsize?: string;
  waist?: string;
  hips?: string;
  tattoos?: string;
  piercings?: string;
  fakeBoobs?: boolean;
  sameSexOnly?: boolean;
  bio?: string;
  links?: Record<string, string | null>;
}

export interface MetadataStudio {
  id: string;
  name: string;
  aliases: string[];
  parent?: {
    id: string;
    name: string;
  };
  urls: Array<{ url: string; site: { name: string } }>;
  images: MetadataImage[];
}

export interface MetadataScene {
  id: string;
  title: string;
  date?: string;
  details?: string;
  duration?: number;
  director?: string;
  code?: string;
  urls: Array<{ url: string; site: { name: string } }>;
  images: MetadataImage[];
  performers: Array<{
    performer: MetadataPerformer;
  }>;
  studio?: MetadataStudio;
  tags: Array<{
    name: string;
  }>;
  /** Content type (scene, jav, movie) - needed for JAV code pattern matching */
  contentType?: "scene" | "jav" | "movie";
  /** Hashes for deduplication (ohash, phash, etc.) */
  hashes?: Array<{ hash: string; type: string }>;
}

export interface IMetadataProvider {
  /**
   * Unique identifier for this metadata provider implementation
   */
  readonly name: string;

  /**
   * Search for performers
   * @param query - Search query string
   * @param limit - Maximum number of results to return
   * @returns Array of performers matching the query
   */
  searchPerformers(query: string, limit?: number): Promise<MetadataPerformer[]>;

  /**
   * Get performer by ID
   * @param id - Performer ID
   * @returns Performer details or null if not found
   */
  getPerformerById(id: string): Promise<MetadataPerformer | null>;

  /**
   * Search for studios
   * @param query - Search query string
   * @param limit - Maximum number of results to return
   * @returns Array of studios matching the query
   */
  searchStudios(query: string, limit?: number): Promise<MetadataStudio[]>;

  /**
   * Get studio by ID
   * @param id - Studio ID
   * @returns Studio details or null if not found
   */
  getStudioById(id: string): Promise<MetadataStudio | null>;

  /**
   * Search for scenes
   * @param query - Search query string
   * @param limit - Maximum number of results to return
   * @param page - Page number for pagination
   * @returns Array of scenes matching the query
   */
  searchScenes(
    query: string,
    limit?: number,
    page?: number
  ): Promise<MetadataScene[]>;

  /**
   * Get scene by ID
   * @param id - Scene ID
   * @returns Scene details or null if not found
   */
  getSceneById(id: string): Promise<MetadataScene | null>;

  /**
   * Get scenes for a performer
   * @param performerId - Performer ID (TPDB/StashDB ID)
   * @param contentType - Content type (scene, jav, movie)
   * @param page - Page number for pagination
   * @returns Object containing scenes array and pagination info
   */
  getPerformerScenes(
    performerId: string,
    contentType: "scene" | "jav" | "movie",
    page: number
  ): Promise<{
    scenes: MetadataScene[];
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
    };
  }>;

  /**
   * Get scene by hash
   * @param hash - Scene hash (OSHASH or PHASH)
   * @param hashType - Type of hash
   * @returns Scene details or null if not found
   */
  getSceneByHash(hash: string, hashType: "OSHASH" | "PHASH"): Promise<MetadataScene | null>;

  /**
   * Test connection to the metadata provider
   * @returns true if connection successful, false otherwise
   */
  testConnection(): Promise<boolean>;

  /**
   * Search for sites/studios (sites are essentially studios in TPDB)
   * @param query - Search query string
   * @param page - Page number for pagination
   * @returns Object containing sites array and pagination info
   */
  searchSites(
    query: string,
    page?: number
  ): Promise<{
    sites: MetadataStudio[];
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
    };
  }>;
}
