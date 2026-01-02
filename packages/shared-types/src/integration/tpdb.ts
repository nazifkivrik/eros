/**
 * ThePornDB API types
 * Based on ThePornDB API v3.24.582
 */

/**
 * Performer resource from ThePornDB API
 */
export type TPDBPerformer = {
  id: string;
  _id: number;
  slug: string;
  name: string;
  full_name: string;
  disambiguation: string | null;
  bio: string | null;
  rating: number;
  is_parent: boolean;
  extras: {
    gender: string | null;
    birthday: string | null;
    birthday_timestamp: number | null;
    deathday: string | null;
    deathday_timestamp: number | null;
    birthplace: string | null;
    birthplace_code: string | null;
    astrology: string | null;
    ethnicity: string | null;
    nationality: string | null;
    hair_colour: string | null;
    eye_colour: string | null;
    weight: string | null;
    height: string | null;
    measurements: string | null;
    cupsize: string | null;
    tattoos: string | null;
    piercings: string | null;
    waist: string | null;
    hips: string | null;
    career_start_year: number | null;
    career_end_year: number | null;
    fake_boobs: boolean;
    same_sex_only: boolean;
    links: Array<{ url: string; platform: string }> | null;
  };
  aliases: string[] | null;
  image: string;
  thumbnail: string;
  face: string;
  posters: TPDBMedia[] | null;
  site_performers: TPDBPerformerSite[] | null;
};

/**
 * Scene resource from ThePornDB API
 */
export type TPDBScene = {
  id: string;
  _id: number;
  title: string;
  type: string;
  slug: string;
  external_id: string;
  description: string;
  rating: number;
  site_id: number;
  date: string;
  url: string;
  image: string;
  back_image: string;
  poster_image: string;
  poster: string;
  trailer: string | null;
  duration: number | null;
  format: string | null;
  sku: string | null;
  background: {
    full: string;
    large: string;
    medium: string;
    small: string;
  };
  media: TPDBMedia;
  created: string;
  last_updated: string;
  performers: TPDBPerformer[];
  site: TPDBSite;
  tags: TPDBTag[];
  hashes: TPDBSceneHash[];
  markers: TPDBMarker[];
  directors: TPDBDirector[];
  scenes: TPDBScene[];
  movies: TPDBScene[];
  links: Array<{ url: string; platform: string }> | null;
};

/**
 * Site (Studio) resource from ThePornDB API
 */
export type TPDBSite = {
  uuid: string;
  id: number;
  parent_id: number;
  network_id: number;
  name: string;
  short_name: string;
  url: string;
  description: string;
  rating: number;
  logo: string;
  favicon: string;
  poster: string;
  network: TPDBSite | null;
  parent: TPDBSite | null;
};

/**
 * Media resource from ThePornDB API
 */
export type TPDBMedia = {
  id: number;
  url: string;
  size: number;
  order: number;
};

/**
 * Tag resource from ThePornDB API
 */
export type TPDBTag = {
  id: number;
  uuid: string;
  name: string;
  parents: TPDBTag[];
};

/**
 * Director resource from ThePornDB API
 */
export type TPDBDirector = {
  id: number;
  uuid: string;
  name: string;
  slug: string;
};

/**
 * Marker resource from ThePornDB API
 */
export type TPDBMarker = {
  id: number;
  title: string;
  start_time: number;
  end_time: number | null;
  created_at: string;
};

/**
 * Scene hash resource from ThePornDB API
 */
export type TPDBSceneHash = {
  hash: string;
  type: string;
  duration: number | null;
};

/**
 * Performer site resource from ThePornDB API
 */
export type TPDBPerformerSite = {
  id: string;
  _id: number;
  site_id: number;
  name: string;
  bio: string;
  is_parent: boolean;
  extras: TPDBPerformer["extras"];
  image: string;
  thumbnail: string;
  face: string;
  scenes: TPDBScene[];
  parent: TPDBPerformer | null;
  site: TPDBSite;
};

/**
 * Pagination meta data from ThePornDB API
 */
export type TPDBMeta = {
  total: number;
  per_page: number;
  current_page: number;
  last: number;
};

/**
 * Paginated response wrapper
 */
export type TPDBPaginatedResponse<T> = {
  data: T[];
  meta: TPDBMeta;
};

/**
 * Single item response wrapper
 */
export type TPDBSingleResponse<T> = {
  data: T;
};

/**
 * Scene search request parameters
 */
export type TPDBSceneSearchParams = {
  page?: number;
  per_page?: number;
  q?: string;
  title?: string;
  date?: string;
  date_operation?: "eq" | "gte" | "lte";
  year?: number;
  duration?: number;
  site?: string;
  site_id?: number;
  site_operation?: "include" | "exclude";
  category_id?: number;
  performer_id?: number;
  performers?: number[];
  performer_and?: boolean;
  performer_genders?: string[];
  performer_gender_and?: boolean;
  performer_gender_only?: boolean;
  director_id?: number;
  directors?: number[];
  director_and?: boolean;
  tags?: number[];
  tag_and?: boolean;
  hash?: string;
  hash_type?: "oshash" | "md5" | "phash";
  external_id?: string;
  sku?: string;
  url?: string;
  is_favourite?: boolean;
  is_collected?: boolean;
  order_by?: "date" | "title" | "rating" | "created" | "updated";
  parse?: string;
};

/**
 * Performer search request parameters
 */
export type TPDBPerformerSearchParams = {
  page?: number;
  per_page?: number;
  q?: string;
  name?: string;
  gender?: string;
  hair_colour?: string;
  eye_colour?: string;
  ethnicity?: string;
  nationality?: string;
  is_parent?: boolean;
  order_by?: "name" | "rating" | "created" | "updated";
};

/**
 * Site search request parameters
 */
export type TPDBSiteSearchParams = {
  page?: number;
  per_page?: number;
  q?: string;
  name?: string;
  network_id?: number;
  parent_id?: number;
  order_by?: "name" | "rating" | "created";
};
