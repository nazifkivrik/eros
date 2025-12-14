import type { Gender } from "../enums.js";
import type { Image } from "../shared.js";

export interface Performer {
  id: string;
  stashdbId: string | null;
  name: string;
  aliases: string[];
  disambiguation: string | null;
  gender: Gender | null;
  birthdate: string | null;
  deathDate: string | null;
  careerStartDate: string | null;
  careerEndDate: string | null;
  images: Image[];
  createdAt: string;
  updatedAt: string;
}
