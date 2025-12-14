import type { Image, Tag, SceneFile } from "../shared.js";
import type { Performer } from "./performer.js";
import type { Studio } from "./studio.js";

export interface Scene {
  id: string;
  stashdbId: string | null;
  title: string;
  date: string | null;
  details: string | null;
  duration: number | null;
  director: string | null;
  code: string | null;
  urls: string[];
  images: Image[];
  hasMetadata: boolean;
  inferredFromIndexers: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SceneWithRelations extends Scene {
  performers: Performer[];
  studios: Studio[];
  tags: Tag[];
  files: SceneFile[];
}

// Search Types
export interface SearchResult {
  performers: Performer[];
  studios: Studio[];
  scenes: SceneWithRelations[];
}
