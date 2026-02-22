import type { Image } from "../api/entities.js";

/**
 * NFO Metadata Type
 * Used for generating NFO files and managing scene metadata in file operations
 */
export type NFOMetadata = {
    id: string;
    externalIds: Array<{ source: string; id: string }>;
    title: string;
    description: string | null;
    date: string | null;
    duration: number | null;
    code: string | null;
    url: string | null;
    trailer: string | null;
    rating: number | null;
    contentType: "scene" | "jav" | "movie" | null;
    images: Image[];
    poster: string | null;
    thumbnail: string | null;
    performers: Array<{
        id: string;
        name: string;
        thumbnail: string | null;
        images: Image[];
        nationality: string | null;
        gender: string | null;
    }>;
    studios: Array<{
        id: string;
        name: string;
    }>;
    tags: string[];
    director: string | null;
};
