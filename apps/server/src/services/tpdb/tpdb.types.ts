export interface TPDBConfig {
  apiUrl: string;
  apiKey: string; // Bearer token
}

// TPDB'deki orjinal content tipleri (sadece metadata için)
export type TPDBContentType = "scene" | "jav" | "movie";

// TPDB API response wrapper
export interface TPDBResponse<T> {
  data: T;
  meta?: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
    path?: string;
    links?: Array<{
      url: string | null;
      label: string;
      page: number | null;
      active: boolean;
    }>;
  };
}

export interface TPDBPerformer {
  id: string;
  _id?: number;
  uuid?: string;
  name: string;
  slug?: string;
  bio?: string;
  extras?: {
    gender?: string;
    birthday?: string | null;
    birthplace?: string | null;
    birthplace_code?: string | null;
    astrology?: string | null;
    ethnicity?: string | null;
    nationality?: string | null;
    hair_colour?: string | null;
    eye_colour?: string | null;
    height?: number | null;
    weight?: number | null;
    cupsize?: string | null;
    fake_boobs?: boolean;
    tattoos?: string | null;
    piercings?: string | null;
    career_start_year?: number | null;
    career_end_year?: number | null;
  };
  parent?: {
    id?: string;
    _id?: number;
    name: string;
    full_name?: string;
    disambiguation?: string | null;
    extras?: any;
  };
  birth_date?: string;
  career_start_year?: number;
  career_end_year?: number;
  measurements?: {
    waist?: number;
    hip?: number;
    chest?: number;
  };
  tattoos?: Array<{ location: string; description?: string }>;
  piercings?: Array<{ location: string; description?: string }>;
  posters?: Array<{ url: string; id?: number; size?: number; order?: number }> | {
    large?: string;
    medium?: string;
    small?: string;
  };
  image?: string;
  thumbnail?: string;
  face?: string;
}

export interface TPDBSite {
  id: string | number;
  uuid?: string;
  name: string;
  short_name?: string;
  description?: string | null;
  rating?: number;
  parent?: {
    id: string | number;
    uuid?: string;
    name: string;
    url?: string;
    description?: string;
  };
  network?: {
    id: string | number;
    uuid?: string;
    name: string;
    url?: string;
    description?: string;
  };
  url?: string;
  logo?: string;
  favicon?: string;
  poster?: string;
  parent_id?: string | number | null;
  network_id?: string | number | null;
}

export interface TPDBScene {
  id: string;
  _id?: number;
  uuid?: string;
  title: string;
  slug?: string;
  type?: string;
  date?: string;
  description?: string;
  duration?: number;
  director?: string;
  code?: string;
  url?: string;
  external_id?: string;
  image?: string;
  back_image?: string | null;
  poster_image?: string | null;
  poster?: string;
  trailer?: string | null;
  format?: string | null;
  sku?: string | null;
  rating?: number;
  background?: {
    full?: string;
    large?: string;
    medium?: string;
    small?: string;
  };
  background_back?: {
    full?: string;
    large?: string;
    medium?: string;
    small?: string;
  };
  posters?: Array<{ url: string }> | {
    large?: string;
    medium?: string;
    small?: string;
  };
  performers?: Array<TPDBPerformer & {
    parent?: {
      id?: string;
      _id?: number;
      name: string;
      disambiguation?: string | null;
      full_name?: string;
      posters?: Array<{ id: number; url: string; size: number; order: number }>;
      image?: string;
      thumbnail?: string;
      face?: string;
    };
  }>;
  site?: TPDBSite;
  site_id?: number;
  tags?: Array<{ id: number; uuid: string; name: string }>;
  directors?: Array<{ id: string; name: string }>;
  links?: Array<{ id: string; url: string; type: string }>;
  hashes?: Array<{
    hash: string;
    type: string;
  }>;
  created?: string;
  last_updated?: string;
}
