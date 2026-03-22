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
      await this.logsService.error(
        "torrent",
        `Quality profile not found: ${qualityProfileId}, no torrents will be selected (STRICT MODE)`,
        { qualityProfileId }
      );
      return null; // STRICT: Don't fallback to first torrent
    }

    // Ensure items array exists and has valid structure
    const profileItems = qualityProfile.items || [];

    // Check if user wants "any" quality or source
    const hasAnyQuality = profileItems.some((item) => item.quality === "any");
    const hasAnySource = profileItems.some((item) => item.source === "any");

    // Filter by quality preferences - keep torrents that match ANY profile item
    let candidates = torrents;

    // Only filter by quality if NOT using "any"
    if (!hasAnyQuality) {
      const allowedQualities = new Set(profileItems.map((item) => item.quality).filter((q) => q && q !== "any"));
      if (allowedQualities.size > 0) {
        candidates = candidates.filter((t) => allowedQualities.has(t.quality));
      }
    }

    // Only filter by source if NOT using "any"
    if (!hasAnySource) {
      const allowedSources = new Set(profileItems.map((item) => item.source).filter((s) => s && s !== "any"));
      if (allowedSources.size > 0) {
        candidates = candidates.filter((t) => allowedSources.has(t.source));
      }
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

    // If no candidates match preferences, return null (STRICT MODE)
    if (candidates.length === 0) {
      await this.logsService.info(
        "torrent",
        `No torrents match quality profile preferences, returning no results (STRICT MODE)`,
        {
          qualityProfileId,
          profileName: qualityProfile.name,
          totalTorrents: torrents.length,
          profileItems: profileItems.map((item) => `${item.quality}/${item.source}`),
        }
      );
      return null; // STRICT: Don't fallback to first torrent
    }

    // Sort candidates by exact (quality, source) combination priority from profile items
    // This preserves the user's preference order for each combination
    const sortedCandidates = candidates.sort((a, b) => {
      // Find the exact (quality, source) combination in profile items
      const aProfileIndex = profileItems.findIndex((item) =>
        (item.quality === "any" || item.quality === a.quality) &&
        (item.source === "any" || item.source === a.source)
      );

      const bProfileIndex = profileItems.findIndex((item) =>
        (item.quality === "any" || item.quality === b.quality) &&
        (item.source === "any" || item.source === b.source)
      );

      // Lower index = higher priority (user's preference order)
      if (aProfileIndex !== bProfileIndex) {
        // If both found, sort by index (lower index = higher priority)
        // If one not found, put it at the end
        const aPriority = aProfileIndex === -1 ? 9999 : aProfileIndex;
        const bPriority = bProfileIndex === -1 ? 9999 : bProfileIndex;
        return aPriority - bPriority;
      }

      // Same priority level? Prefer higher seeders
      if (a.seeders !== b.seeders) {
        return b.seeders - a.seeders;
      }

      // Same seeders? Prefer higher indexer count (more indexers = more reliable)
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
