/**
 * Torrent Search Manual Service
 * Handles manual torrent search with cross-encoder ranking
 *
 * Responsibilities:
 * - Manual search via Prowlarr
 * - Cross-Encoder ranking of results against scene metadata
 * - Score aggregation and result transformation
 */

import type { IIndexer } from "@/infrastructure/adapters/interfaces/indexer.interface.js";
import type { LogsService } from "@/application/services/logs.service.js";
import type { ScenesRepository } from "@/infrastructure/repositories/scenes.repository.js";
import type { CrossEncoderService } from "@/application/services/ai-matching/cross-encoder.service.js";
import type { Candidate, MatchQuery } from "@/application/services/ai-matching/cross-encoder.service.js";
import type { TorrentResult } from "./index.js";

/**
 * Manual search result with match score
 */
export type ManualSearchResult = TorrentResult & {
  matchScore: number; // 0-100 percentage
  matchReason: string;
};

/**
 * Scene metadata from database
 */
interface SceneMetadata {
  id: string;
  title: string;
  date: string | null;
  performerIds: string[];
  studioId?: string;
  performerNames?: string[];
  studioName?: string;
}

/**
 * Clean torrent title for matching
 * Removes common patterns like quality, source, site tags
 */
function cleanTorrentTitle(title: string): string {
  return title
    .toLowerCase()
    // Remove quality tags
    .replace(/\b(2160p|1080p|720p|480p|4k)\b/gi, "")
    // Remove source tags
    .replace(/\b(web-dl|webrip|bluray|blu-ray|hdtv|web)\b/gi, "")
    // Remove site tags (common pattern: Site.Name - Title)
    .replace(/^[a-z0-9-]+\s*-\s*/i, "")
    // Remove file extension
    .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i, "")
    // Remove common codec tags
    .replace(/\b(x264|x265|h\.264|h\.265|hevc)\b/gi, "")
    // Remove extra whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean performer names and aliases from title
 * This removes performer names from ANYWHERE in the title (start, middle, end)
 * Copied from torrent-search.match.service.ts for consistent matching
 */
function cleanPerformersFromTitle(
  title: string,
  performerName: string,
  aliases?: string[]
): string {
  let cleaned = title;

  // Escape regex special characters
  const escapeRegex = (str: string) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Build list of all names to remove (main name + aliases)
  const namesToRemove = [performerName, ...(aliases || [])];

  // First, remove "aka" patterns WITH performer names
  for (const name of namesToRemove) {
    const akaPattern = new RegExp(
      `${escapeRegex(performerName)}\\s+(aka|a\\.k\\.a\\.|also known as)\\s+${escapeRegex(name)}|${escapeRegex(name)}\\s+(aka|a\\.k\\.a\\.|also known as)\\s+${escapeRegex(performerName)}`,
      "gi"
    );
    cleaned = cleaned.replace(akaPattern, " ");
  }

  // Then, remove individual performer names
  for (const name of namesToRemove) {
    const pattern = new RegExp(
      `[-–—:,]?\\s*${escapeRegex(name)}\\s*[-–—:,]?`,
      "gi"
    );
    cleaned = cleaned.replace(pattern, " ");
  }

  // Remove any remaining "aka" patterns
  cleaned = cleaned.replace(/\s+(aka|a\.k\.a\.|also known as)\s+/gi, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (cleaned.length < 5) {
    return title;
  }

  // Remove common file extensions and suffixes
  cleaned = cleaned
    .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm)$/gi, "")
    .replace(/\s+[-–—:,]?\s*(XXX|xxx|1080p|720p|480p|2160p|4K|P2P|XC|Leech)?\s*$/g, "")
    .trim();

  return cleaned;
}

/**
 * Torrent Search Manual Service
 */
export class TorrentSearchManualService {
  private indexer: IIndexer;
  private crossEncoderService: CrossEncoderService;
  private scenesRepository: ScenesRepository;
  private logsService: LogsService;

  constructor(deps: {
    indexer: IIndexer;
    crossEncoderService: CrossEncoderService;
    scenesRepository: ScenesRepository;
    logsService: LogsService;
  }) {
    this.indexer = deps.indexer;
    this.crossEncoderService = deps.crossEncoderService;
    this.scenesRepository = deps.scenesRepository;
    this.logsService = deps.logsService;
  }

  /**
   * Manual search for a specific scene with cross-encoder ranking
   */
  async searchManualForScene(
    sceneId: string,
    query: string,
    limit = 50
  ): Promise<ManualSearchResult[]> {
    await this.logsService.info(
      "torrent-search",
      `Manual search for scene ${sceneId} with query "${query}"`,
      { sceneId, query, limit }
    );

    // Fetch scene metadata from database
    const scene = await this.scenesRepository.findById(sceneId);
    if (!scene) {
      await this.logsService.warning(
        "torrent-search",
        `Scene not found: ${sceneId}`,
        { sceneId }
      );
      return [];
    }

    // Fetch performers for the scene
    const performers = await this.scenesRepository.getPerformersForScene(sceneId);
    const performerNames = performers.map((p) => p.name);

    // Build scene metadata
    const sceneMetadata: SceneMetadata = {
      id: scene.id,
      title: scene.title,
      date: scene.date,
      performerIds: performers.map((p) => p.id),
      studioId: scene.studioId,
      performerNames,
      studioName: scene.studioId ? undefined : undefined, // Studio name would need separate query
    };

    // Search Prowlarr with user query
    const rawResults = await this.searchIndexers(query, limit);

    await this.logsService.info(
      "torrent-search",
      `Prowlarr returned ${rawResults.length} results for query "${query}"`,
      { sceneId, query, resultCount: rawResults.length }
    );

    // Rank results using cross-encoder
    const rankedResults = await this.rankResults(rawResults, sceneMetadata);

    await this.logsService.info(
      "torrent-search",
      `Manual search complete: ${rankedResults.length} ranked results`,
      {
        sceneId,
        sceneTitle: scene.title,
        query,
        totalResults: rawResults.length,
        rankedResults: rankedResults.length,
      }
    );

    // Sort by match score descending
    return rankedResults.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Search indexers with query string
   */
  private async searchIndexers(
    query: string,
    limit: number
  ): Promise<TorrentResult[]> {
    const results: TorrentResult[] = [];

    if (!this.indexer) {
      await this.logsService.warning("torrent-search", `No indexer configured`, {
        query,
      });
      return results;
    }

    try {
      const indexerResults = await this.indexer.search(query, { limit });

      for (const result of indexerResults) {
        const dbIndexerId = `prowlarr-${result.indexerId}`;

        results.push({
          title: result.title,
          size: result.size,
          seeders: result.seeders,
          leechers: result.leechers,
          quality: this.detectQuality(result.title),
          source: this.detectSource(result.title),
          indexerId: dbIndexerId,
          indexerName: result.indexer,
          downloadUrl: result.downloadUrl || result.magnetUrl || "",
          infoHash: result.infoHash,
        });
      }
    } catch (error) {
      await this.logsService.error(
        "torrent-search",
        `Failed to search indexers for "${query}": ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          query,
          error: error instanceof Error ? error.stack : String(error),
        }
      );
    }

    return results;
  }

  /**
   * Rank results using cross-encoder
   * Follows the same approach as subscription search job:
   * - Clean performer names from both torrent and scene titles
   * - Pass performer: undefined to cross-encoder (title-only matching)
   */
  private async rankResults(
    torrents: TorrentResult[],
    sceneMetadata: SceneMetadata
  ): Promise<ManualSearchResult[]> {
    if (torrents.length === 0) {
      return [];
    }

    // Get primary performer name for cleaning
    const primaryPerformerName = sceneMetadata.performerNames?.[0];

    // Clean performer name from scene title for matching
    let cleanedSceneTitle = sceneMetadata.title;
    if (primaryPerformerName) {
      cleanedSceneTitle = cleanPerformersFromTitle(
        sceneMetadata.title,
        primaryPerformerName
      );
      await this.logsService.info(
        "torrent-search",
        `Cleaned performer name from scene title`,
        {
          originalTitle: sceneMetadata.title,
          cleanedTitle: cleanedSceneTitle,
          performerName: primaryPerformerName,
        }
      );
    }

    // Build match query - performer is undefined like in subscription search
    const matchQuery: MatchQuery = {
      performer: undefined,  // Title-only matching, performer removed
      studio: sceneMetadata.studioName,
      date: sceneMetadata.date || undefined,
      title: cleanedSceneTitle,  // Use cleaned title without performer name
    };

    // Build candidates from torrents - also clean performer names
    const candidates: Candidate[] = torrents.map((torrent) => {
      let cleanedTitle = cleanTorrentTitle(torrent.title);

      // Also remove performer name from torrent title for fair comparison
      if (primaryPerformerName) {
        cleanedTitle = cleanPerformersFromTitle(
          cleanedTitle,
          primaryPerformerName
        );
      }

      return {
        id: torrent.infoHash || torrent.downloadUrl,
        title: cleanedTitle,
        date: undefined,
        studio: torrent.source,
        performers: [],
      };
    });

    try {
      // Use cross-encoder to score all candidates
      const scores = await this.crossEncoderService.scoreBatch(
        [matchQuery],
        candidates
      );

      const results: ManualSearchResult[] = [];

      for (let i = 0; i < torrents.length; i++) {
        const torrent = torrents[i];
        const score = scores[0]?.[i] ?? 0;
        const matchPercentage = Math.round(score * 100);

        let matchReason = "Cross-Encoder match";
        if (matchPercentage >= 90) {
          matchReason = "Excellent match - All metadata aligns";
        } else if (matchPercentage >= 75) {
          matchReason = "Good match - Strong similarity";
        } else if (matchPercentage >= 60) {
          matchReason = "Fair match - Some similarity";
        } else {
          matchReason = "Poor match - Low confidence";
        }

        results.push({
          ...torrent,
          matchScore: matchPercentage,
          matchReason,
        });
      }

      return results;
    } catch (error) {
      await this.logsService.error(
        "torrent-search",
        `Cross-Encoder scoring failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          error: error instanceof Error ? error.stack : String(error),
        }
      );

      // Fallback: return results without scores
      return torrents.map((torrent) => ({
        ...torrent,
        matchScore: 0,
        matchReason: "Scoring failed - match unknown",
      }));
    }
  }

  /**
   * Detect quality from torrent title
   */
  private detectQuality(title: string): string {
    const titleLower = title.toLowerCase();
    if (titleLower.includes("2160p") || titleLower.includes("4k"))
      return "2160p";
    if (titleLower.includes("1080p")) return "1080p";
    if (titleLower.includes("720p")) return "720p";
    if (titleLower.includes("480p")) return "480p";
    return "Unknown";
  }

  /**
   * Detect source from torrent title
   */
  private detectSource(title: string): string {
    const titleLower = title.toLowerCase();
    if (titleLower.includes("web-dl") || titleLower.includes("webdl"))
      return "WEB-DL";
    if (titleLower.includes("webrip")) return "WEBRip";
    if (titleLower.includes("bluray") || titleLower.includes("blu-ray"))
      return "BluRay";
    if (titleLower.includes("hdtv")) return "HDTV";
    return "Unknown";
  }
}
