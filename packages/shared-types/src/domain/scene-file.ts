import type { Resolution } from "../api/quality-profile.js";

export type SceneFileDomain = {
  id: string;
  sceneId: string;
  filePath: string;
  size: number;
  quality: Resolution;
  dateAdded: string;
  relativePath: string;
};
