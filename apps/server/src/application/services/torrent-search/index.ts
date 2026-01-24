/**
 * Torrent Search Service
 * Main orchestrator for torrent search functionality
 *
 * This service coordinates all torrent search subservices:
 * - Core orchestration (this file)
 * - Indexer service (external search)
 * - Filter service (deduplication, filtering, grouping)
 * - Match service (scene matching with AI)
 * - Quality service (quality profile-based selection)
 */

import type { TorrentsRepository } from "@/infrastructure/repositories/torrents.repository.js";
import type { IIndexer } from "@/infrastructure/adapters/interfaces/indexer.interface.js";
import type { LogsService } from "@/application/services/logs.service.js";
import type { SettingsService } from "@/application/services/settings.service.js";
import type { AIMatchingService } from "@/application/services/ai-matching/ai-matching.service.js";
import type { CrossEncoderService } from "@/application/services/ai-matching/cross-encoder.service.js";
import type { AIMatchScoresRepository } from "@/infrastructure/repositories/ai-match-scores.repository.js";
import type { SceneMetadata } from "@/infrastructure/repositories/torrents.repository.js";
import { TorrentSearchIndexerService } from "./torrent-search.indexer.service.js";
import { TorrentSearchFilterService } from "./torrent-search.filter.service.js";
import { TorrentSearchMatchService } from "./torrent-search.match.service.js";
import { TorrentSearchQualityService } from "./torrent-search.quality.service.js";
import { logger } from "@/utils/logger.js";

/**
 * Torrent result from search
 */
export type TorrentResult = {
  title: string;
  size: number;
  seeders: number;
  leechers?: number;
  quality: string;
  source: string;
  indexerId: string;
  indexerName: string;
  downloadUrl: string;
  infoHash: string;
  sceneId?: string;
  indexers?: string[];
  indexerCount?: number;
};

/**
 * Scene group for matching
 */
export type SceneGroup = {
  sceneTitle: string;
  torrents: TorrentResult[];
};

/**
 * Matched scene result
 */
export type MatchedScene = {
  scene: SceneMetadata;
  torrents: TorrentResult[];
};

/**
 * Unmatched scene result
 */
export type UnmatchedScene = {
  sceneTitle: string;
  torrents: TorrentResult[];
};

/**
 * Match result from metadata matching
 */
export type MatchResult = {
  matched: MatchedScene[];
  unmatched: UnmatchedScene[];
};

/**
 * Torrent Search Service
 * Main orchestrator for torrent search workflow
 */
export class TorrentSearchService {
  private repository: TorrentsRepository;
  private indexerService: TorrentSearchIndexerService;
  private filterService: TorrentSearchFilterService;
  private matchService: TorrentSearchMatchService;
  private qualityService: TorrentSearchQualityService;
  private logsService: LogsService;
  private settingsService: SettingsService;

  constructor(deps: {
    torrentsRepository: TorrentsRepository;
    indexer: IIndexer;
    logsService: LogsService;
    settingsService: SettingsService;
    aiMatchingService: AIMatchingService;
    crossEncoderService: CrossEncoderService;
    aiMatchScoresRepository: AIMatchScoresRepository;
  }) {
    this.repository = deps.torrentsRepository;
    this.logsService = deps.logsService;
    this.settingsService = deps.settingsService;

    // Initialize subservices
    this.indexerService = new TorrentSearchIndexerService({
      indexer: deps.indexer,
      logsService: deps.logsService,
    });

    this.filterService = new TorrentSearchFilterService({
      logsService: deps.logsService,
    });

    this.matchService = new TorrentSearchMatchService({
      repository: this.repository,
      aiMatchingService: deps.aiMatchingService,
      crossEncoderService: deps.crossEncoderService,
      aiMatchScoresRepository: deps.aiMatchScoresRepository,
      logsService: deps.logsService,
      settingsService: deps.settingsService,
    });

    this.qualityService = new TorrentSearchQualityService({
      repository: this.repository,
      logsService: deps.logsService,
    });
  }

  /**
   * Main entry point: Search for torrents for a subscription
   * This is the main workflow orchestrator
   */
  async searchForSubscription(
    entityType: "performer" | "studio",
    entityId: string,
    qualityProfileId: string,
    includeMetadataMissing: boolean,
    includeAliases: boolean,
    indexerIds: string[]
  ): Promise<TorrentResult[]> {
    // Log search start
    await this.logsService.info(
      "torrent",
      `Starting torrent search for ${entityType}: ${entityId}`,
      {
        entityType,
        entityId,
        qualityProfileId,
        includeMetadataMissing,
        includeAliases,
      },
      entityType === "performer"
        ? { performerId: entityId }
        : { studioId: entityId }
    );

    try {
      // Get entity details
      const entity =
        entityType === "performer"
          ? await this.repository.findPerformerById(entityId)
          : await this.repository.findStudioById(entityId);

      if (!entity) {
        await this.logsService.warning("torrent", `Entity not found for search`, {
          entityType,
          entityId,
        });
        return [];
      }

      // Step 1: Search Phase
      const rawResults = await this.indexerService.searchIndexers(
        entityType,
        entity,
        includeAliases,
        indexerIds
      );

      await this.logsService.info(
        "torrent",
        `Search phase complete: ${rawResults.length} raw results`,
        {
          resultCount: rawResults.length,
        }
      );

      // Step 2: Deduplicate by infoHash
      const deduplicatedResults =
        this.filterService.deduplicateByInfoHash(rawResults);

      await this.logsService.info(
        "torrent",
        `Deduplicated ${rawResults.length} results to ${deduplicatedResults.length} unique torrents`,
        {
          before: rawResults.length,
          after: deduplicatedResults.length,
          removed: rawResults.length - deduplicatedResults.length,
        }
      );

      // Step 3: Hard Filtering (Name Integrity)
      const filteredResults = await this.filterService.applyHardFilters(
        deduplicatedResults,
        entityType,
        entity
      );

      // Step 4: Group by Scene
      const groupedResults =
        this.filterService.groupByScene(filteredResults);

      await this.logsService.info(
        "torrent",
        `Grouped ${filteredResults.length} torrents into ${groupedResults.length} scene groups`,
        {
          totalTorrents: filteredResults.length,
          sceneGroups: groupedResults.length,
        }
      );

      // Step 5: Match against Database Metadata
      const { matched, unmatched } = await this.matchService.matchWithMetadata(
        groupedResults,
        entityType,
        entity
      );

      await this.logsService.info(
        "torrent",
        `Matched ${matched.length} scenes, ${unmatched.length} unmatched`,
        {
          matched: matched.length,
          unmatched: unmatched.length,
        }
      );

      // Step 6: Handle Discovery for unmatched (if Cross-Encoder is enabled)
      const settings = await this.settingsService.getSettings();
      if (settings.ai.useCrossEncoder && unmatched.length > 0) {
        await this.matchService.handleDiscovery(
          unmatched,
          entity,
          entityType
        );
      }

      // Step 7: Process Matched Results (with quality selection)
      const matchedTorrents = await this.qualityService.processMatchedResults(
        matched,
        qualityProfileId
      );

      // Step 8: Process Unmatched Results (metadata-less scenes)
      const minGroupMembers = settings.ai.groupingCount || 2;
      const unmatchedTorrents = includeMetadataMissing
        ? await this.qualityService.processUnmatchedResults(
            unmatched,
            qualityProfileId,
            minGroupMembers
          )
        : [];

      const allSelectedTorrents = [...matchedTorrents, ...unmatchedTorrents];

      // Log completion
      await this.logsService.info(
        "torrent",
        `Completed torrent search: ${allSelectedTorrents.length} torrents selected`,
        {
          totalRawResults: rawResults.length,
          afterHardFilters: filteredResults.length,
          groupedScenes: groupedResults.length,
          matchedScenes: matched.length,
          unmatchedScenes: unmatched.length,
          selectedTorrents: allSelectedTorrents.length,
        }
      );

      return allSelectedTorrents;
    } catch (error) {
      await this.logsService.error(
        "torrent",
        `Torrent search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { error: error instanceof Error ? error.stack : String(error) }
      );
      throw error;
    }
  }
}

/**
 * Factory function for creating TorrentSearchService
 */
export function createTorrentSearchService(deps: {
  torrentsRepository: TorrentsRepository;
  indexer: IIndexer;
  logsService: LogsService;
  settingsService: SettingsService;
  aiMatchingService: AIMatchingService;
  crossEncoderService: CrossEncoderService;
  aiMatchScoresRepository: AIMatchScoresRepository;
}): TorrentSearchService {
  return new TorrentSearchService(deps);
}

// Export all subservices for testing
export { TorrentSearchIndexerService } from "./torrent-search.indexer.service.js";
export { TorrentSearchFilterService } from "./torrent-search.filter.service.js";
export { TorrentSearchMatchService } from "./torrent-search.match.service.js";
export { TorrentSearchQualityService } from "./torrent-search.quality.service.js";
