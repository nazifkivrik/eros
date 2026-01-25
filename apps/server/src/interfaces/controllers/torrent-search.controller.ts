/**
 * Torrent Search Controller
 * Handles HTTP request/response for torrent search endpoints
 *
 * Responsibilities:
 * - HTTP request/response handling only
 * - Request validation
 * - Call service methods
 * - No business logic
 */

import type { FastifyReply } from "fastify";
import type { TorrentSearchService } from "@/application/services/torrent-search/index.js";
import type { LogsService } from "@/application/services/logs.service.js";
import type {
  SearchByEntityRequest,
  ManualSearchRequest,
  TorrentResult,
} from "@/modules/torrent-search/torrent-search.schema.js";

/**
 * Torrent Search Controller
 */
export class TorrentSearchController {
  private torrentSearchService: TorrentSearchService;
  private logsService: LogsService;

  constructor(deps: {
    torrentSearchService: TorrentSearchService;
    logsService: LogsService;
  }) {
    this.torrentSearchService = deps.torrentSearchService;
    this.logsService = deps.logsService;
  }

  /**
   * Search torrents for an entity (performer/studio)
   * POST /api/torrent-search/subscriptions/:entityType/:entityId/search
   */
  async searchForEntity(
    request: {
      Params: { entityType: "performer" | "studio"; entityId: string };
      Body: {
        qualityProfileId: string;
        includeMetadataMissing: boolean;
        includeAliases: boolean;
        indexerIds: string[];
      };
    },
    _reply: FastifyReply
  ): Promise<TorrentResult[]> {
    const { entityType, entityId } = request.Params;
    const {
      qualityProfileId,
      includeMetadataMissing,
      includeAliases,
      indexerIds,
    } = request.Body;

    await this.logsService.info(
      "torrent-search",
      `HTTP API: Search for ${entityType} ${entityId}`,
      {
        entityType,
        entityId,
        qualityProfileId,
        includeMetadataMissing,
        includeAliases,
        indexerIds,
      },
      entityType === "performer"
        ? { performerId: entityId }
        : { studioId: entityId }
    );

    try {
      const results = await this.torrentSearchService.searchForSubscription(
        entityType,
        entityId,
        qualityProfileId,
        includeMetadataMissing,
        includeAliases,
        indexerIds
      );

      await this.logsService.info(
        "torrent-search",
        `HTTP API: Found ${results.length} torrents for ${entityType} ${entityId}`,
        {
          entityType,
          entityId,
          resultCount: results.length,
        }
      );

      return results;
    } catch (error) {
      await this.logsService.error(
        "torrent-search",
        `HTTP API: Search failed for ${entityType} ${entityId}: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          entityType,
          entityId,
          error: error instanceof Error ? error.stack : String(error),
        }
      );
      throw error;
    }
  }

  /**
   * Manual torrent search
   * POST /api/torrent-search/manual
   */
  async searchManual(
    request: {
      Body: {
        query: string;
        qualityProfileId?: string;
        limit?: number;
      };
    },
    _reply: FastifyReply
  ): Promise<TorrentResult[]> {
    const { query, qualityProfileId, limit = 50 } = request.Body;

    await this.logsService.info(
      "torrent-search",
      `HTTP API: Manual search for "${query}"`,
      {
        query,
        qualityProfileId,
        limit,
      }
    );

    // TODO: Implement manual search
    // This would use the indexer directly to search for torrents
    throw new Error("Manual search not yet implemented");
  }
}

/**
 * Factory function for creating TorrentSearchController
 */
export function createTorrentSearchController(deps: {
  torrentSearchService: TorrentSearchService;
  logsService: LogsService;
}): TorrentSearchController {
  return new TorrentSearchController(deps);
}
