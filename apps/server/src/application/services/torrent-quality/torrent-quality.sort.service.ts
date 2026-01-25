/**
 * Torrent Quality Sort Service
 * Handles quality-based sorting of torrent results
 *
 * Responsibilities:
 * - Quality profile-based sorting
 * - Multi-criteria sorting (quality priority, seeders, match score)
 */

import type { ParsedTorrent, QualityProfileItem } from "./torrent-quality.types.js";

/**
 * Torrent Quality Sort Service
 */
export class TorrentQualitySortService {
  /**
   * Sort torrents by quality profile order (best to worst)
   */
  sortByQualityProfile(
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
   * Sort by seeders (descending)
   */
  sortBySeeders(torrents: ParsedTorrent[]): ParsedTorrent[] {
    return [...torrents].sort((a, b) => b.seeders - a.seeders);
  }

  /**
   * Sort by match score (descending)
   */
  sortByMatchScore(torrents: ParsedTorrent[]): ParsedTorrent[] {
    return [...torrents].sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Sort by size (ascending)
   */
  sortBySize(torrents: ParsedTorrent[]): ParsedTorrent[] {
    return [...torrents].sort((a, b) => a.size - b.size);
  }

  /**
   * Multi-criteria sort with custom weights
   */
  multiCriteriaSort(
    torrents: ParsedTorrent[],
    weights: {
      qualityPriority?: number;
      seeders?: number;
      matchScore?: number;
      size?: number;
    } = {}
  ): ParsedTorrent[] {
    const {
      qualityPriority = 1.0,
      seeders = 0.5,
      matchScore = 0.3,
      size = 0.1,
    } = weights;

    return [...torrents].sort((a, b) => {
      // Calculate weighted score for each torrent
      const aScore =
        this.calculateScore(a, weights) * qualityPriority +
        a.seeders * seeders +
        a.matchScore * matchScore +
        (1 / a.size) * size;

      const bScore =
        this.calculateScore(b, weights) * qualityPriority +
        b.seeders * seeders +
        b.matchScore * matchScore +
        (1 / b.size) * size;

      return bScore - aScore;
    });
  }

  /**
   * Helper for multi-criteria sort
   */
  private calculateScore(
    torrent: ParsedTorrent,
    _weights: { qualityPriority?: number }
  ): number {
    // This would need access to profileItems to calculate priority
    // For now, return a placeholder value
    return torrent.matchScore;
  }
}
