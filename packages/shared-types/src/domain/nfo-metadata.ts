import type { Image } from "../api/entities.js";

/**
 * NFO Metadata Type
 * Used for generating NFO files and managing scene metadata in file operations
 */
export type NFOMetadata = {
    id: string;
    externalIds: Array<{ source: string; id: string }>;
    title: string;
    date: string | null;
    duration: number | null;
    code: string | null;
    url: string | null;
    images: Image[];
    performers: Array<{
        id: string;
        name: string;
    }>;
    studios: Array<{
        id: string;
        name: string;
    }>;
};
