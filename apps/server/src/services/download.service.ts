import type { Database } from "@repo/database";
import { eq } from "drizzle-orm";
import { qualityProfiles } from "@repo/database";
import type { AIMatchingService } from "./ai-matching.service.js";

export type TorrentResult = {
  title: string;
  magnetLink: string;
  size: number; // in bytes
  seeders: number;
  leechers: number;
  indexerId: string;
  indexerName: string;
  category: string;
  publishDate?: string;
};

export type ParsedTorrent = TorrentResult & {
  quality: string; // "2160p", "1080p", etc.
  source: string; // "bluray", "webdl", etc.
  matchScore: number; // 0-100, fuzzy match score
};

export type QualityProfileItem = {
  quality: string;
  source: string;
  minSeeders: number | "any";
  maxSize: number; // in GB
};

export class DownloadService {
  constructor(
    private db: Database,
    private aiService: AIMatchingService | null = null
  ) {}

  /**
   * Select best torrent based on quality profile
   */
  async selectBestTorrent(
    torrents: ParsedTorrent[],
    qualityProfileId: string
  ): Promise<ParsedTorrent | null> {
    // Get quality profile
    const profile = await this.db.query.qualityProfiles.findFirst({
      where: eq(qualityProfiles.id, qualityProfileId),
    });

    if (!profile) {
      throw new Error(`Quality profile ${qualityProfileId} not found`);
    }

    // Filter torrents by quality profile rules
    const filtered = this.filterByQualityProfile(torrents, profile.items as QualityProfileItem[]);

    if (filtered.length === 0) {
      return null;
    }

    // Sort by quality profile order (best quality first)
    const sorted = this.sortByQualityProfile(filtered, profile.items as QualityProfileItem[]);

    // Return the best match
    return sorted[0];
  }

  /**
   * Filter torrents based on quality profile constraints
   */
  private filterByQualityProfile(
    torrents: ParsedTorrent[],
    profileItems: QualityProfileItem[]
  ): ParsedTorrent[] {
    return torrents.filter((torrent) => {
      // Find matching quality item
      const matchingItem = profileItems.find(
        (item) =>
          (item.quality === "any" || item.quality === torrent.quality) &&
          (item.source === "any" || item.source === torrent.source)
      );

      if (!matchingItem) {
        return false;
      }

      // Check min seeders
      if (
        matchingItem.minSeeders !== "any" &&
        torrent.seeders < matchingItem.minSeeders
      ) {
        return false;
      }

      // Check max size (convert bytes to GB)
      const sizeInGB = torrent.size / (1024 * 1024 * 1024);
      if (matchingItem.maxSize > 0 && sizeInGB > matchingItem.maxSize) {
        return false;
      }

      return true;
    });
  }

  /**
   * Sort torrents by quality profile order (best to worst)
   */
  private sortByQualityProfile(
    torrents: ParsedTorrent[],
    profileItems: QualityProfileItem[]
  ): ParsedTorrent[] {
    return [...torrents].sort((a, b) => {
      // Find quality priority for each torrent
      const aPriority = this.getQualityPriority(a, profileItems);
      const bPriority = this.getQualityPriority(b, profileItems);

      // Lower priority number = better quality (0 is best)
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // If same priority, prefer higher seeders
      if (a.seeders !== b.seeders) {
        return b.seeders - a.seeders;
      }

      // If same seeders, prefer higher match score
      return b.matchScore - a.matchScore;
    });
  }

  /**
   * Get quality priority index from profile
   */
  private getQualityPriority(
    torrent: ParsedTorrent,
    profileItems: QualityProfileItem[]
  ): number {
    const index = profileItems.findIndex(
      (item) =>
        (item.quality === "any" || item.quality === torrent.quality) &&
        (item.source === "any" || item.source === torrent.source)
    );

    // If not found in profile, put it at the end
    return index === -1 ? 9999 : index;
  }

  /**
   * Calculate match score between torrent title and expected title
   * Uses AI matching if available, falls back to Levenshtein distance
   */
  async calculateMatchScore(
    torrentTitle: string,
    expectedTitle: string
  ): Promise<number> {
    // Use AI matching if available
    if (this.aiService) {
      try {
        return await this.calculateMatchScoreAI(torrentTitle, expectedTitle);
      } catch (error) {
        // Fall back to Levenshtein if AI fails
        console.error("AI matching failed, falling back to Levenshtein:", error);
      }
    }

    // Levenshtein-based matching
    return this.calculateMatchScoreLevenshtein(torrentTitle, expectedTitle);
  }

  /**
   * Calculate match score using AI semantic similarity
   */
  private async calculateMatchScoreAI(
    torrentTitle: string,
    expectedTitle: string
  ): Promise<number> {
    if (!this.aiService) {
      throw new Error("AI service not available");
    }

    // Preprocess both titles
    const processedTorrent = this.aiService.preprocessText(torrentTitle);
    const processedExpected = this.aiService.preprocessText(expectedTitle);

    // Calculate semantic similarity (returns 0-1)
    const similarity = await this.aiService.calculateSimilarity(
      processedTorrent,
      processedExpected
    );

    // Convert to 0-100 scale
    return Math.round(similarity * 100);
  }

  /**
   * Calculate match score using Levenshtein distance
   */
  private calculateMatchScoreLevenshtein(
    torrentTitle: string,
    expectedTitle: string
  ): number {
    const normalizedTorrent = this.normalizeTitle(torrentTitle);
    const normalizedExpected = this.normalizeTitle(expectedTitle);

    const distance = this.levenshteinDistance(
      normalizedTorrent,
      normalizedExpected
    );
    const maxLength = Math.max(
      normalizedTorrent.length,
      normalizedExpected.length
    );

    // Convert distance to similarity score (0-100)
    const similarity = ((maxLength - distance) / maxLength) * 100;

    return Math.max(0, Math.min(100, Math.round(similarity)));
  }

  /**
   * Normalize title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // Remove special characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Apply hard filters to remove obvious false positives
   */
  applyHardFilters(
    torrents: ParsedTorrent[],
    _expectedTitle: string,
    minMatchScore = 60
  ): ParsedTorrent[] {
    return torrents.filter((torrent) => {
      // Filter by match score threshold
      if (torrent.matchScore < minMatchScore) {
        return false;
      }

      // Filter out very small files (likely samples or fake)
      const sizeInMB = torrent.size / (1024 * 1024);
      if (sizeInMB < 100) {
        return false;
      }

      // Filter out very large files (likely full site rips or collection packs)
      const sizeInGB = torrent.size / (1024 * 1024 * 1024);
      if (sizeInGB > 50) {
        return false;
      }

      return true;
    });
  }

  /**
   * Parse quality from torrent title
   */
  parseQuality(title: string): { quality: string; source: string } {
    const titleLower = title.toLowerCase();

    // Detect quality
    let quality = "any";
    if (/2160p|4k|uhd/.test(titleLower)) {
      quality = "2160p";
    } else if (/1080p/.test(titleLower)) {
      quality = "1080p";
    } else if (/720p/.test(titleLower)) {
      quality = "720p";
    } else if (/480p/.test(titleLower)) {
      quality = "480p";
    }

    // Detect source
    let source = "any";
    if (/bluray|blu-ray|bdrip|brrip/.test(titleLower)) {
      source = "bluray";
    } else if (/web-?dl/.test(titleLower)) {
      source = "webdl";
    } else if (/webrip|web-?rip/.test(titleLower)) {
      source = "webrip";
    } else if (/hdtv/.test(titleLower)) {
      source = "hdtv";
    } else if (/dvd|dvdrip/.test(titleLower)) {
      source = "dvd";
    }

    return { quality, source };
  }
}

export function createDownloadService(
  db: Database,
  aiService: AIMatchingService | null = null
): DownloadService {
  return new DownloadService(db, aiService);
}
