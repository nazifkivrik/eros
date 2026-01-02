import type { MetaSourceType } from "../core/enums.js";

export type MetaSource = {
  id: string;
  name: string;
  type: MetaSourceType;
  baseUrl: string;
  apiKey: string | null;
  priority: number;
  enabled: boolean;
  createdAt: string;
};
