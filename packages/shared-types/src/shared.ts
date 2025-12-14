import type { Quality } from "./enums.js";

// Image Types
export interface Image {
  url: string;
  width?: number;
  height?: number;
}

// Tag Types
export interface Tag {
  id: string;
  name: string;
}

// Quality Types
export interface QualityItem {
  quality: Quality;
  source: "bluray" | "webdl" | "webrip" | "hdtv" | "dvd" | "any";
  minSeeders: number | "any";
  maxSize: number; // in GB, 0 means unlimited
}

export interface QualityProfile {
  id: string;
  name: string;
  items: QualityItem[];
  createdAt: string;
  updatedAt: string;
}

// Speed Profile Types (moved from speed-profile.service.ts)
export interface SpeedProfileRule {
  name: string;
  enabled: boolean;
  startHour: number;
  endHour: number;
  daysOfWeek: number[];
  downloadLimit: number | null;
  uploadLimit: number | null;
}

export interface SpeedProfileSettings {
  enabled: boolean;
  rules: SpeedProfileRule[];
  defaultDownloadLimit: number | null;
  defaultUploadLimit: number | null;
}

// Indexer Types
export interface Indexer {
  id: string;
  name: string;
  type: "prowlarr" | "manual";
  baseUrl: string;
  apiKey: string | null;
  priority: number;
  enabled: boolean;
  categories: string[];
  createdAt: string;
}

// Meta Source Types
export interface MetaSource {
  id: string;
  name: string;
  type: "stashdb" | "theporndb" | "custom";
  baseUrl: string;
  apiKey: string | null;
  priority: number;
  enabled: boolean;
  createdAt: string;
}

// Torrent Types
export interface Torrent {
  hash: string;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  ratio: number;
  state: string;
  category: string;
  savePath: string;
  addedOn: number;
  completionOn: number | null;
  seeders: number;
  leechers: number;
}

// Scene File Types
export interface SceneFile {
  id: string;
  sceneId: string;
  filePath: string;
  size: number;
  quality: Quality;
  dateAdded: string;
  relativePath: string;
}
