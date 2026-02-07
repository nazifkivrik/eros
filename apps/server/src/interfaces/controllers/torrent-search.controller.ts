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
import type { TorrentSearchManualService } from "@/application/services/torrent-search/torrent-search.manual.service.js";
import type { ManualSearchResult } from "@/application/services/torrent-search/torrent-search.manual.service.js";

/**
 * Torrent Search Controller
 */
export class TorrentSearchController {
  private torrentSearchService: TorrentSearchService;
  private torrentSearchManualService: TorrentSearchManualService;
  private logsService: LogsService;

  constructor(deps: {
    torrentSearchService: TorrentSearchService;
    torrentSearchManualService: TorrentSearchManualService;
    logsService: LogsService;
  }) {
    this.torrentSearchService = deps.torrentSearchService;
    this.torrentSearchManualService = deps.torrentSearchManualService;
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
    const { query, limit = 50 } = request.Body;

    await this.logsService.info(
      "torrent-search",
      `HTTP API: Manual search for "${query}"`,
      {
        query,
        limit,
      }
    );

    try {
      // Manual search without scene context - returns unranked results
      const results = await this.torrentSearchManualService.searchManualForScene(
        "", // Empty scene ID - service will handle this
        query,
        limit
      );

      await this.logsService.info(
        "torrent-search",
        `HTTP API: Manual search returned ${results.length} results`,
        {
          query,
          resultCount: results.length,
        }
      );

      return results;
    } catch (error) {
      await this.logsService.error(
        "torrent-search",
        `HTTP API: Manual search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          query,
          error: error instanceof Error ? error.stack : String(error),
        }
      );
      throw error;
    }
  }

  /**
   * Manual torrent search for a specific scene with cross-encoder ranking
   * POST /api/torrent-search/manual/scenes/:sceneId
   */
  async searchManualForScene(
    request: {
      Params?: { sceneId: string };
      params?: { sceneId: string };
      Body?: { query?: string; limit?: number };
      body?: { query?: string; limit?: number };
    },
    _reply: FastifyReply
  ): Promise<ManualSearchResult[]> {
    const { sceneId } = request.Params || request.params || {};
    const { query, limit = 50 } = request.Body || request.body || {};

    await this.logsService.info(
      "torrent-search",
      `HTTP API: Manual search for scene ${sceneId} with query "${query || "auto"}"`,
      {
        sceneId,
        query: query || "auto",
        limit,
      }
    );

    try {
      const results = await this.torrentSearchManualService.searchManualForScene(
        sceneId,
        query || "", // Empty query will be handled by service
        limit
      );

      await this.logsService.info(
        "torrent-search",
        `HTTP API: Scene manual search returned ${results.length} ranked results`,
        {
          sceneId,
          resultCount: results.length,
          topScore: results[0]?.matchScore ?? 0,
        }
      );

      return results;
    } catch (error) {
      await this.logsService.error(
        "torrent-search",
        `HTTP API: Scene manual search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          sceneId,
          error: error instanceof Error ? error.stack : String(error),
        }
      );
      throw error;
    }
  }
}

/**
 * Factory function for creating TorrentSearchController
 */
export function createTorrentSearchController(deps: {
  torrentSearchService: TorrentSearchService;
  torrentSearchManualService: TorrentSearchManualService;
  logsService: LogsService;
}): TorrentSearchController {
  return new TorrentSearchController(deps);
}
