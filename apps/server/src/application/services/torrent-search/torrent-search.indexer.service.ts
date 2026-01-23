/**
 * Torrent Search Indexer Service
 * Handles external search via IIndexer adapter
 *
 * Responsibilities:
 * - External search via IIndexer adapter
 * - Quality/source detection from titles
 * - Raw result transformation
 */

import type { IIndexer, SearchResult } from "../../../infrastructure/adapters/interfaces/indexer.interface.js";
import type { LogsService } from "../../logs.service.js";
import type { TorrentResult } from "../torrent-search/index.js";

/**
 * Torrent Search Indexer Service
 */
export class TorrentSearchIndexerService {
  private indexer: IIndexer;
  private logsService: LogsService;

  constructor(deps: { indexer: IIndexer; logsService: LogsService }) {
    this.indexer = deps.indexer;
    this.logsService = deps.logsService;
  }

  /**
   * Search indexers for performer/studio
   */
  async searchIndexers(
    entityType: "performer" | "studio",
    entity: { name: string; aliases?: string[] },
    includeAliases: boolean,
    _indexerIds: string[]
  ): Promise<TorrentResult[]> {
    const results: TorrentResult[] = [];

    // Build search terms
    const searchTerms: string[] = [entity.name];
    if (includeAliases && entity.aliases && entity.aliases.length > 0) {
      searchTerms.push(...entity.aliases);
    }

    // Check if indexer is configured
    if (!this.indexer) {
      await this.logsService.warning("torrent", `No indexer configured`, {
        entityType,
        entityId: entity.name,
      });
      return results;
    }

    // Search using indexer adapter for each search term
    for (const term of searchTerms) {
      try {
        const indexerResults = await this.indexer.search(term, {
          limit: 1000,
        });

        // Convert indexer results to our format
        for (const result of indexerResults) {
          // Convert indexerId to our database format: prowlarr-{id}
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

        await this.logsService.info(
          "torrent",
          `Indexer returned ${indexerResults.length} results for "${term}"`,
          { term, resultCount: indexerResults.length }
        );
      } catch (error) {
        await this.logsService.error(
          "torrent",
          `Failed to search indexer for "${term}": ${error instanceof Error ? error.message : "Unknown error"}`,
          {
            term,
            error: error instanceof Error ? error.stack : String(error),
          }
        );
      }
    }

    await this.logsService.info(
      "torrent",
      `Total indexer results: ${results.length}`,
      { totalResults: results.length, searchTerms: searchTerms.length }
    );

    return results;
  }

  /**
   * Detect quality from torrent title
   */
  detectQuality(title: string): string {
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
  detectSource(title: string): string {
    const titleLower = title.toLowerCase();
    if (titleLower.includes("web-dl") || titleLower.includes("webdl"))
      return "WEB-DL";
    if (titleLower.includes("webrip")) return "WEBRip";
    if (
      titleLower.includes("bluray") ||
      titleLower.includes("blu-ray")
    )
      return "BluRay";
    if (titleLower.includes("hdtv")) return "HDTV";
    return "Unknown";
  }
}
