/**
 * Torrent Search Quality Service
 * Handles quality profile-based torrent selection
 *
 * Responsibilities:
 * - Quality profile-based torrent selection
 * - Matched result processing
 * - Unmatched result processing
 */

import type { TorrentsRepository } from "@/infrastructure/repositories/torrents.repository.js";
import type { LogsService } from "@/application/services/logs.service.js";
import type { MatchedScene, TorrentResult, UnmatchedScene } from "@/application/services/torrent-search/index.js";

/**
 * Quality profile from database
 */
type QualityProfile = {
  id: string;
  name: string;
  preferredQualities: string[];
  preferredSources: string[];
  minSize?: number;
  maxSize?: number;
  minSeeders?: number;
};

/**
 * Torrent Search Quality Service
 */
export class TorrentSearchQualityService {
  private repository: TorrentsRepository;
  private logsService: LogsService;

  constructor(deps: { repository: TorrentsRepository; logsService: LogsService }) {
    this.repository = deps.repository;
    this.logsService = deps.logsService;
  }

  /**
   * Select best torrent from a list based on quality profile
   */
  async selectBestTorrent(
    torrents: TorrentResult[],
    qualityProfileId: string
  ): Promise<TorrentResult | null> {
    if (torrents.length === 0) {
      return null;
    }

    // Get quality profile
    const qualityProfile =
      await this.repository.findQualityProfileById(qualityProfileId);

    if (!qualityProfile) {
      await this.logsService.warning(
        "torrent",
        `Quality profile not found: ${qualityProfileId}, using first torrent`,
        { qualityProfileId }
      );
      return torrents[0];
    }

    // Ensure items array exists and has valid structure
    const profileItems = qualityProfile.items || [];

    // Extract preferred qualities and sources from items
    const preferredQualities = profileItems
      .map((item) => item.quality)
      .filter((q) => q && q !== "any") || [];

    const preferredSources = profileItems
      .map((item) => item.source)
      .filter((s) => s && s !== "any") || [];

    // Filter by quality preferences
    let candidates = torrents;

    if (preferredQualities.length > 0) {
      candidates = candidates.filter((t) =>
        preferredQualities.includes(t.quality)
      );
    }

    if (preferredSources.length > 0) {
      candidates = candidates.filter((t) =>
        preferredSources.includes(t.source)
      );
    }

    // Apply filters from quality profile items
    // Get the max size and min seeders from all items
    const maxSizes = qualityProfile.items.map(item => item.maxSize).filter(v => v > 0);
    const overallMaxSize = maxSizes.length > 0 ? Math.max(...maxSizes) : 0;
    const minSeedersList = qualityProfile.items.map(item => item.minSeeders).filter(v => typeof v === 'number');
    const overallMinSeeders = minSeedersList.length > 0 ? Math.max(...minSeedersList) : 0;

    // Apply size filters
    if (overallMaxSize > 0) {
      candidates = candidates.filter((t) => t.size <= overallMaxSize * 1024 * 1024 * 1024); // Convert GB to bytes
    }

    // Apply seeder filter
    if (overallMinSeeders > 0) {
      candidates = candidates.filter(
        (t) => t.seeders >= overallMinSeeders
      );
    }

    // If no candidates match preferences, use all torrents
    if (candidates.length === 0) {
      await this.logsService.info(
        "torrent",
        `No torrents match quality profile preferences, using first available`,
        {
          qualityProfileId,
          profileName: qualityProfile.name,
          totalTorrents: torrents.length,
        }
      );
      return torrents[0];
    }

    // Sort candidates by priority:
    // 1. Quality preference order
    // 2. Source preference order
    // 3. Seeder count (descending)
    // 4. Indexer count (descending) - more indexers = more reliable
    const sortedCandidates = candidates.sort((a, b) => {
      // Sort by quality preference
      const aQualityIndex = preferredQualities.indexOf(a.quality);
      const bQualityIndex = preferredQualities.indexOf(b.quality);

      if (
        aQualityIndex !== -1 &&
        bQualityIndex !== -1 &&
        aQualityIndex !== bQualityIndex
      ) {
        return aQualityIndex - bQualityIndex;
      }

      // Sort by source preference
      const aSourceIndex = preferredSources.indexOf(a.source);
      const bSourceIndex = preferredSources.indexOf(b.source);

      if (
        aSourceIndex !== -1 &&
        bSourceIndex !== -1 &&
        aSourceIndex !== bSourceIndex
      ) {
        return aSourceIndex - bSourceIndex;
      }

      // Sort by seeders
      if (a.seeders !== b.seeders) {
        return b.seeders - a.seeders;
      }

      // Sort by indexer count (more indexers = more reliable)
      const aIndexerCount = a.indexerCount || 1;
      const bIndexerCount = b.indexerCount || 1;

      return bIndexerCount - aIndexerCount;
    });

    const selected = sortedCandidates[0];

    await this.logsService.info(
      "torrent",
      `Selected best torrent for scene`,
      {
        qualityProfileId,
        profileName: qualityProfile.name,
        selectedTitle: selected.title,
        selectedQuality: selected.quality,
        selectedSource: selected.source,
        selectedSeeders: selected.seeders,
        selectedIndexers: selected.indexerCount,
        totalCandidates: candidates.length,
      }
    );

    return selected;
  }

  /**
   * Process matched results with quality selection
   * Selects best torrent for each matched scene
   */
  async processMatchedResults(
    matched: MatchedScene[],
    qualityProfileId: string
  ): Promise<TorrentResult[]> {
    const selectedTorrents: TorrentResult[] = [];

    for (const { scene, torrents } of matched) {
      const selected = await this.selectBestTorrent(torrents, qualityProfileId);

      if (selected) {
        // Attach sceneId to selected torrent
        selected.sceneId = scene.id;
        selectedTorrents.push(selected);
      }
    }

    await this.logsService.info(
      "torrent",
      `Processed ${matched.length} matched scenes`,
      {
        matchedScenes: matched.length,
        selectedTorrents: selectedTorrents.length,
      }
    );

    return selectedTorrents;
  }

  /**
   * Process unmatched results (metadata-less scenes)
   * Includes group size filtering to avoid spam scenes
   */
  async processUnmatchedResults(
    unmatched: UnmatchedScene[],
    qualityProfileId: string,
    minGroupMembers: number
  ): Promise<TorrentResult[]> {
    const selectedTorrents: TorrentResult[] = [];

    // Filter by minimum group members to avoid spam
    const validGroups = unmatched.filter(
      (group) => group.torrents.length >= minGroupMembers
    );

    const filteredOut = unmatched.length - validGroups.length;

    if (filteredOut > 0) {
      await this.logsService.info(
        "torrent",
        `Filtered out ${filteredOut} unmatched groups with insufficient members`,
        {
          totalUnmatched: unmatched.length,
          minGroupMembers,
          filteredOut,
          remainingGroups: validGroups.length,
        }
      );
    }

    // Select best torrent for each valid group
    for (const { sceneTitle, torrents } of validGroups) {
      const selected = await this.selectBestTorrent(torrents, qualityProfileId);

      if (selected) {
        // Don't attach sceneId for unmatched scenes
        selectedTorrents.push(selected);
      }
    }

    await this.logsService.info(
      "torrent",
      `Processed ${validGroups.length} unmatched scenes`,
      {
        validGroups: validGroups.length,
        selectedTorrents: selectedTorrents.length,
      }
    );

    return selectedTorrents;
  }
}
