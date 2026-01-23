/**
 * Torrent Quality Filter Service
 * Handles quality profile-based filtering of torrent results
 *
 * Responsibilities:
 * - Quality profile filtering
 * - Hard filters (size, match score)
 */

import type { LogsService } from "../../logs.service.js";
import type { ParsedTorrent, QualityProfileItem } from "./torrent-quality.types.js";

/**
 * Torrent Quality Filter Service
 */
export class TorrentQualityFilterService {
  private logsService: LogsService;

  constructor(deps: { logsService: LogsService }) {
    this.logsService = deps.logsService;
  }

  /**
   * Filter torrents based on quality profile constraints
   */
  filterByQualityProfile(
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
   * Apply hard filters to remove obvious false positives
   */
  applyHardFilters(
    torrents: ParsedTorrent[],
    _expectedTitle: string,
    minMatchScore = 60
  ): ParsedTorrent[] {
    const filtered = torrents.filter((torrent) => {
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

    const eliminated = torrents.length - filtered.length;
    if (eliminated > 0) {
      this.logsService.info(
        "torrent",
        `Hard filters eliminated ${eliminated} torrents`,
        {
          before: torrents.length,
          after: filtered.length,
          eliminated,
        }
      );
    }

    return filtered;
  }

  /**
   * Apply size filters
   */
  applySizeFilters(
    torrents: ParsedTorrent[],
    minSize?: number,
    maxSize?: number
  ): ParsedTorrent[] {
    return torrents.filter((torrent) => {
      const sizeInGB = torrent.size / (1024 * 1024 * 1024);

      if (minSize !== undefined && sizeInGB < minSize) {
        return false;
      }

      if (maxSize !== undefined && sizeInGB > maxSize) {
        return false;
      }

      return true;
    });
  }

  /**
   * Apply score filter
   */
  applyScoreFilter(
    torrents: ParsedTorrent[],
    minScore?: number
  ): ParsedTorrent[] {
    if (minScore === undefined) {
      return torrents;
    }

    return torrents.filter((torrent) => torrent.matchScore >= minScore);
  }
}
