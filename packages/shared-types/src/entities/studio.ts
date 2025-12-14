import type { Image } from "../shared.js";

export interface Studio {
  id: string;
  stashdbId: string | null;
  name: string;
  aliases: string[];
  parentStudioId: string | null;
  images: Image[];
  url: string | null;
  createdAt: string;
  updatedAt: string;
}
