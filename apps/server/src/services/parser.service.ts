/**
 * Torrent Parser Service
 * Parses torrent titles to extract quality, resolution, codec, and other metadata
 */

import type { Quality } from "@repo/shared-types";

interface ParsedTorrent {
  title: string;
  quality: Quality | null;
  resolution: string | null;
  codec: string | null;
  source: string | null;
  hdr: boolean;
  proper: boolean;
  repack: boolean;
  size: number;
  seeders: number;
  originalTitle: string;
}

export class TorrentParserService {
  /**
   * Parse a torrent title to extract metadata
   */
  parseTorrent(
    title: string,
    size: number = 0,
    seeders: number = 0
  ): ParsedTorrent {
    const originalTitle = title;
    const titleLower = title.toLowerCase();

    return {
      title: this.extractCleanTitle(title),
      quality: this.extractQuality(titleLower),
      resolution: this.extractResolution(titleLower),
      codec: this.extractCodec(titleLower),
      source: this.extractSource(titleLower),
      hdr: this.hasHDR(titleLower),
      proper: titleLower.includes("proper"),
      repack: titleLower.includes("repack"),
      size,
      seeders,
      originalTitle,
    };
  }

  /**
   * Extract clean title (remove quality tags, resolution, etc.)
   */
  private extractCleanTitle(title: string): string {
    // Remove common tags in brackets/parentheses
    let clean = title.replace(/[\[\(].*?[\]\)]/g, " ");

    // Remove quality indicators
    clean = clean.replace(
      /\b(2160p|1080p|720p|480p|bluray|webdl|web-dl|webrip|hdtv|dvd|brrip|hdrip)\b/gi,
      " "
    );

    // Remove codec info
    clean = clean.replace(/\b(h264|h265|x264|x265|hevc|avc)\b/gi, " ");

    // Remove extra spaces
    clean = clean.replace(/\s+/g, " ").trim();

    return clean;
  }

  /**
   * Extract quality from title
   */
  private extractQuality(title: string): Quality | null {
    // 2160p (4K)
    if (title.includes("2160p")) {
      if (title.includes("bluray") || title.includes("blu-ray")) {
        return "2160p_bluray";
      }
      if (
        title.includes("webdl") ||
        title.includes("web-dl") ||
        title.includes("webrip")
      ) {
        return "2160p_webdl";
      }
      return "2160p_webdl"; // Default to webdl for 2160p
    }

    // 1080p
    if (title.includes("1080p")) {
      if (title.includes("bluray") || title.includes("blu-ray")) {
        return "1080p_bluray";
      }
      if (
        title.includes("webdl") ||
        title.includes("web-dl") ||
        title.includes("webrip")
      ) {
        return "1080p_webdl";
      }
      return "1080p_webdl"; // Default to webdl for 1080p
    }

    // 720p
    if (title.includes("720p")) {
      if (title.includes("bluray") || title.includes("blu-ray")) {
        return "720p_bluray";
      }
      if (
        title.includes("webdl") ||
        title.includes("web-dl") ||
        title.includes("webrip")
      ) {
        return "720p_webdl";
      }
      return "720p_webdl"; // Default to webdl for 720p
    }

    // 480p
    if (title.includes("480p")) {
      return "480p_webdl";
    }

    // DVD
    if (title.includes("dvd") && !title.includes("dvdrip")) {
      return "dvd";
    }

    return "any";
  }

  /**
   * Extract resolution from title
   */
  private extractResolution(title: string): string | null {
    if (title.includes("2160p")) return "2160p";
    if (title.includes("1080p")) return "1080p";
    if (title.includes("720p")) return "720p";
    if (title.includes("480p")) return "480p";
    return null;
  }

  /**
   * Extract codec from title
   */
  private extractCodec(title: string): string | null {
    if (title.includes("h265") || title.includes("x265") || title.includes("hevc"))
      return "H.265";
    if (title.includes("h264") || title.includes("x264") || title.includes("avc"))
      return "H.264";
    return null;
  }

  /**
   * Extract source from title
   */
  private extractSource(title: string): string | null {
    if (title.includes("bluray") || title.includes("blu-ray")) return "Bluray";
    if (title.includes("webdl") || title.includes("web-dl")) return "WEB-DL";
    if (title.includes("webrip")) return "WEBRip";
    if (title.includes("hdtv")) return "HDTV";
    if (title.includes("dvd")) return "DVD";
    return null;
  }

  /**
   * Check if torrent has HDR
   */
  private hasHDR(title: string): boolean {
    return (
      title.includes("hdr") ||
      title.includes("hdr10") ||
      title.includes("dolby vision") ||
      title.includes("dv")
    );
  }

  /**
   * Calculate a score for quality selection
   * Higher score = better quality
   */
  calculateQualityScore(parsed: ParsedTorrent): number {
    let score = 0;

    // Resolution score
    switch (parsed.resolution) {
      case "2160p":
        score += 400;
        break;
      case "1080p":
        score += 300;
        break;
      case "720p":
        score += 200;
        break;
      case "480p":
        score += 100;
        break;
    }

    // Source score
    switch (parsed.source) {
      case "Bluray":
        score += 50;
        break;
      case "WEB-DL":
        score += 40;
        break;
      case "WEBRip":
        score += 30;
        break;
      case "HDTV":
        score += 20;
        break;
      case "DVD":
        score += 10;
        break;
    }

    // Codec score
    if (parsed.codec === "H.265") score += 10;
    if (parsed.codec === "H.264") score += 5;

    // HDR bonus
    if (parsed.hdr) score += 15;

    // Proper/Repack bonus
    if (parsed.proper) score += 5;
    if (parsed.repack) score += 3;

    // Seeders score (more seeders = better)
    score += Math.min(parsed.seeders / 10, 50); // Max 50 points from seeders

    return score;
  }

  /**
   * Check if torrent matches hard filters
   */
  matchesFilters(parsed: ParsedTorrent, filters: {
    minResolution?: string;
    maxResolution?: string;
    requiredWords?: string[];
    forbiddenWords?: string[];
    minSeeders?: number;
    maxSize?: number; // in GB
  }): boolean {
    const titleLower = parsed.originalTitle.toLowerCase();

    // Check required words
    if (filters.requiredWords && filters.requiredWords.length > 0) {
      const hasAllRequired = filters.requiredWords.every((word) =>
        titleLower.includes(word.toLowerCase())
      );
      if (!hasAllRequired) return false;
    }

    // Check forbidden words
    if (filters.forbiddenWords && filters.forbiddenWords.length > 0) {
      const hasForbidden = filters.forbiddenWords.some((word) =>
        titleLower.includes(word.toLowerCase())
      );
      if (hasForbidden) return false;
    }

    // Check minimum seeders
    if (filters.minSeeders && parsed.seeders < filters.minSeeders) {
      return false;
    }

    // Check maximum size (convert bytes to GB)
    if (filters.maxSize) {
      const sizeInGB = parsed.size / (1024 * 1024 * 1024);
      if (sizeInGB > filters.maxSize) return false;
    }

    return true;
  }

  /**
   * Select best torrent from a list based on quality profile
   */
  selectBestTorrent(
    torrents: ParsedTorrent[],
    qualityProfile: Array<{ quality: Quality; order: number }>
  ): ParsedTorrent | null {
    if (torrents.length === 0) return null;

    // Filter torrents by quality profile
    const qualityMap = new Map(
      qualityProfile.map((item) => [item.quality, item.order])
    );

    // Score each torrent
    const scoredTorrents = torrents.map((torrent) => {
      let score = 0;

      // Quality profile order (lower order = higher priority)
      if (torrent.quality) {
        const order = qualityMap.get(torrent.quality);
        if (order !== undefined) {
          score += (100 - order) * 10; // Invert order for scoring
        }
      }

      // Add base quality score
      score += this.calculateQualityScore(torrent);

      return { torrent, score };
    });

    // Sort by score (highest first)
    scoredTorrents.sort((a, b) => b.score - a.score);

    return scoredTorrents[0].torrent;
  }
}

// Export factory function
export function createTorrentParserService() {
  return new TorrentParserService();
}
