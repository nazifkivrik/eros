/**
 * Torrent Search Match Service
 * Handles scene matching with Cross-Encoder AI
 *
 * Responsibilities:
 * - Scene matching using Cross-Encoder AI with validation
 * - Candidate scene fetching
 * - Discovery handling (logging only)
 * - Levenshtein distance calculation
 */

import type { TorrentsRepository, SceneMetadata } from "@/infrastructure/repositories/torrents.repository.js";
import type { AIMatchingService } from "@/application/services/ai-matching/ai-matching.service.js";
import type { CrossEncoderService } from "@/application/services/ai-matching/cross-encoder.service.js";
import type { AIMatchScoresRepository } from "@/infrastructure/repositories/ai-match-scores.repository.js";
import type { LogsService } from "@/application/services/logs.service.js";
import type { SettingsService } from "@/application/services/settings.service.js";
import type { SceneGroup, MatchResult, TorrentResult } from "@/application/services/torrent-search/index.js";
import { eq, and } from "drizzle-orm";
import { performersScenes, subscriptions } from "@repo/database";
import { logger } from "@/utils/logger.js";

/**
 * Torrent Search Match Service
 */
export class TorrentSearchMatchService {
  private repository: TorrentsRepository;
  private aiMatchingService: AIMatchingService;
  private crossEncoderService: CrossEncoderService;
  private aiMatchScoresRepository: AIMatchScoresRepository;
  private logsService: LogsService;
  private settingsService: SettingsService;

  constructor(deps: {
    repository: TorrentsRepository;
    aiMatchingService: AIMatchingService;
    crossEncoderService: CrossEncoderService;
    aiMatchScoresRepository: AIMatchScoresRepository;
    logsService: LogsService;
    settingsService: SettingsService;
  }) {
    this.repository = deps.repository;
    this.aiMatchingService = deps.aiMatchingService;
    this.crossEncoderService = deps.crossEncoderService;
    this.aiMatchScoresRepository = deps.aiMatchScoresRepository;
    this.logsService = deps.logsService;
    this.settingsService = deps.settingsService;
  }

  /**
   * Match torrent groups with database scenes
   * Uses Cross-Encoder AI matching with validation
   */
  async matchWithMetadata(
    groups: SceneGroup[],
    entityType: "performer" | "studio",
    entity: { id: string; name: string; aliases?: string[] }
  ): Promise<MatchResult> {
    // Get settings for threshold
    const settings = await this.settingsService.getSettings();
    const threshold = settings.ai.crossEncoderThreshold ?? 0.75;

    await this.logsService.info(
      "torrent",
      "Using Cross-Encoder Only Matching for scene matching",
      {
        torrentGroups: groups.length,
        threshold,
      }
    );

    return await this.matchWithCrossEncoderOnly(groups, entity, entityType, threshold);
  }

  /**
   * Legacy matching using SceneMatcher
   */
  private async matchWithLegacy(
    groups: SceneGroup[],
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<MatchResult> {
    // Import SceneMatcher dynamically
    const { SceneMatcher } = await import("@/application/services/matching/scene-matcher.service.js");

    // Get match settings
    const matchSettings = {
      aiEnabled: false,
      aiThreshold: 0.7,
      groupingThreshold: 0.7,
      levenshteinThreshold: 0.7,
    };

    // Initialize SceneMatcher
    const matcher = new SceneMatcher({
      aiMatchingService: this.aiMatchingService,
      logsService: this.logsService,
    });

    // Fetch candidate scenes
    const candidateScenes = await this.fetchCandidateScenes(
      entityType,
      entityId
    );

    const matched: Array<{ scene: SceneMetadata; torrents: TorrentResult[] }> = [];
    const unmatched: SceneGroup[] = [];
    const matchedSceneIds = new Set<string>();

    for (const group of groups) {
      const availableScenes = candidateScenes.filter(
        (s) => !matchedSceneIds.has(s.id)
      );

      if (availableScenes.length === 0) {
        unmatched.push(group);
        continue;
      }

      // Find best match using SceneMatcher
      const matchResult = await matcher.findBestMatch(
        group.sceneTitle,
        availableScenes,
        matchSettings
      );

      if (matchResult) {
        matchedSceneIds.add(matchResult.scene.id);

        // Get performer IDs for this scene
        const performerIds = await this.repository.findPerformersBySceneId(
          matchResult.scene.id
        );

        matched.push({
          scene: {
            ...matchResult.scene,
            performerIds,
            studioId: matchResult.scene.studioId ?? undefined,
          },
          torrents: group.torrents,
        });

        await this.logsService.info(
          "torrent",
          `Matched "${group.sceneTitle}" to "${matchResult.scene.title}"`,
          {
            method: matchResult.method,
            score: matchResult.score,
            confidence: matchResult.confidence,
          }
        );
      } else {
        unmatched.push(group);
      }
    }

    return { matched, unmatched };
  }

  /**
   * Cross-Encoder Only Matching with Improved Validation
   *
   * Uses only Cross-Encoder AI matching but with better validation rules:
   * - Higher threshold for confidence (0.75)
   - Date matching bonus
   - Studio matching bonus
   * - Reject matches with very different title lengths
   */
  private async matchWithCrossEncoderOnly(
    groups: SceneGroup[],
    entity: { id: string; name: string },
    entityType: "performer" | "studio",
    threshold: number
  ): Promise<MatchResult> {
    // Get candidate scenes from database
    const candidateScenes = await this.getCandidateScenes(entityType, entity.id);

    // Get performer with aliases for cleaning
    let performerWithAliases: { name: string; aliases?: string[] } | null = null;
    if (entityType === "performer") {
      const performer = await this.repository.findPerformerById(entity.id);
      if (performer) {
        performerWithAliases = {
          name: performer.name,
          aliases: Array.isArray(performer.aliases)
            ? performer.aliases
            : performer.aliases
            ? JSON.parse(performer.aliases as string)
            : undefined,
        };
      }
    }

    const matched: Array<{ scene: SceneMetadata; torrents: TorrentResult[] }> = [];
    const unmatched: SceneGroup[] = [];
    const matchedSceneIds = new Set<string>();

    // Load Cross-Encoder once for all groups
    await this.crossEncoderService.initialize();

    try {
      await this.logsService.info(
        "torrent",
        `Cross-Encoder Only Matching Started`,
        {
          entityType,
          entityName: entity.name,
          torrentGroups: groups.length,
          candidateScenes: candidateScenes.length,
        }
      );

      for (const group of groups) {
        const availableScenes = candidateScenes.filter(
          (s) => !matchedSceneIds.has(s.id)
        );

        if (availableScenes.length === 0) {
          unmatched.push(group);
          continue;
        }

        // Clean performer/studio name from torrent title for matching
        let cleanedTitle = group.sceneTitle;
        if (entityType === "performer" && performerWithAliases) {
          cleanedTitle = this.cleanPerformersFromTitle(
            group.sceneTitle,
            performerWithAliases.name,
            performerWithAliases.aliases
          );
        } else if (entityType === "studio") {
          cleanedTitle = this.cleanEntityNameFromTitle(
            group.sceneTitle,
            entity.name,
            "studio"
          );
        }

        // Prepare candidates for Cross-Encoder (clean performer names)
        const crossEncoderCandidates = availableScenes.map((s) => {
          let cleanedSceneTitle = s.title;
          if (entityType === "performer" && performerWithAliases) {
            cleanedSceneTitle = this.cleanPerformersFromTitle(
              s.title,
              performerWithAliases.name,
              performerWithAliases.aliases
            );
          }
          return {
            id: s.id,
            title: cleanedSceneTitle,
            date: s.date || undefined,
            studio: s.studioName,
            performers: s.performerNames,
          };
        });

        const crossEncoderMatch = await this.crossEncoderService.findBestMatch(
          {
            performer: undefined,
            studio: undefined,
            title: cleanedTitle,
          },
          crossEncoderCandidates,
          threshold // Use threshold from settings
        );

        if (crossEncoderMatch) {
          const scene = availableScenes.find((s) => s.id === crossEncoderMatch.candidate.id)!;

          // Additional validation: Check title length similarity
          // Prevent matching very long titles to very short titles
          const torrentTitleLength = cleanedTitle.length;
          const sceneTitleLength = scene.title.length;
          const lengthRatio = Math.min(torrentTitleLength, sceneTitleLength) /
                               Math.max(torrentTitleLength, sceneTitleLength);

          // Reject if length ratio is too extreme (< 0.3 means one is 3x longer than the other)
          if (lengthRatio < 0.3) {
            await this.logsService.info(
              "torrent",
              `✗ Rejected "${group.sceneTitle}" (Title length too different)`,
              {
                torrentTitle: group.sceneTitle,
                torrentTitleLength,
                sceneTitle: scene.title,
                sceneTitleLength,
                lengthRatio,
                crossEncoderScore: crossEncoderMatch.score,
              }
            );
            unmatched.push(group);
            continue;
          }

          // Match accepted
          matchedSceneIds.add(scene.id);

          // Get performer IDs for this scene
          const performerIds = await this.repository.findPerformersBySceneId(scene.id);

          matched.push({
            scene: {
              ...scene,
              performerIds,
              studioId: scene.studioId ?? undefined,
            },
            torrents: group.torrents,
          });

          await this.logsService.info(
            "torrent",
            `✓ Matched "${group.sceneTitle}" to "${scene.title}"`,
            {
              crossEncoderScore: crossEncoderMatch.score,
              lengthRatio,
            }
          );
        } else {
          // No match - REJECT
          await this.logsService.info(
            "torrent",
            `✗ Rejected "${group.sceneTitle}" (No Cross-Encoder match above threshold)`,
            {
              cleanedTitle,
              threshold,
            }
          );

          unmatched.push(group);
        }
      }

      await this.logsService.info(
        "torrent",
        `Cross-Encoder Only Matching Complete`,
        {
          matched: matched.length,
          unmatched: unmatched.length,
        }
      );

      return { matched, unmatched };
    } finally {
      // Always unload Cross-Encoder
      this.crossEncoderService.unload();
    }
  }

  /**
   * Clean entity name from the start of title
   */
  private cleanEntityNameFromTitle(
    title: string,
    entityName: string,
    _entityType: "performer" | "studio"
  ): string {
    let cleaned = title;
    const escapeRegex = (str: string) =>
      str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const startPattern = new RegExp(
      `^${escapeRegex(entityName)}\\s*[-–—:,]?\\s*`,
      "i"
    );
    if (startPattern.test(cleaned)) {
      cleaned = cleaned.replace(startPattern, "");
    }

    // Clean up leading/trailing punctuation and spaces
    cleaned = cleaned.replace(/^[-–—:,\s]+|[-–—:,\s]+$/g, "").trim();

    if (cleaned.length < 5) {
      cleaned = title;
    }

    return cleaned;
  }

  /**
   * Clean all performer names and aliases from scene title
   * This removes performer names from ANYWHERE in the title (start, middle, end)
   * Also removes common suffixes/prefixes like "xxx", "mp4", etc.
   *
   * ENHANCED: Removes "aka" patterns AND performer names together
   * Handles: "Name1 aka Name2", "Name1 aka Name2 - Title", etc.
   */
  private cleanPerformersFromTitle(
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
    // This handles: "Name1 aka Name2", "Name1 a.k.a. Name2", "Name1 also known as Name2"
    for (const name of namesToRemove) {
      // Pattern: "Performer aka Name" or "Name aka Performer"
      const akaPattern = new RegExp(
        `${escapeRegex(performerName)}\\s+(aka|a\\.k\\.a\\.|also known as)\\s+${escapeRegex(name)}|${escapeRegex(name)}\\s+(aka|a\\.k\\.a\\.|also known as)\\s+${escapeRegex(performerName)}`,
        "gi"
      );
      cleaned = cleaned.replace(akaPattern, " ");
    }

    // Then, remove individual performer names (remaining ones)
    for (const name of namesToRemove) {
      // Pattern matches the name with optional surrounding separators
      const pattern = new RegExp(
        `[-–—:,]?\\s*${escapeRegex(name)}\\s*[-–—:,]?`,
        "gi"
      );
      cleaned = cleaned.replace(pattern, " ");
    }

    // Remove any remaining "aka" patterns without names
    cleaned = cleaned
      .replace(/\s+(aka|a\.k\.a\.|also known as)\s+/gi, " ");

    // Clean up extra spaces and trim
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    // If title became too short after cleaning, return original
    if (cleaned.length < 5) {
      return title;
    }

    // Remove common file extensions and site suffixes
    cleaned = cleaned
      .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|mp4)$/gi, "")
      .replace(/\s+[-–—:,]?\s*(XXX|xxx|1080p|720p|480p|2160p|4K|P2P|XC|Leech|XLeech)?\s*$/g, "")
      .trim();

    return cleaned;
  }

  /**
   * Handle discovery of unknown scenes
   */
  async handleDiscovery(
    unmatchedGroups: SceneGroup[],
    entity: { id: string; name: string },
    entityType: "performer" | "studio",
    _searchPhase: "performer" | "studio" | "targeted"
  ): Promise<void> {
    const minIndexers = 3;

    await this.logsService.info("torrent", `Discovery Phase Started`, {
      unmatchedGroups: unmatchedGroups.length,
      minIndexersRequired: minIndexers,
      entityType,
      entityName: entity.name,
    });

    let discoveredCount = 0;

    for (const group of unmatchedGroups) {
      const uniqueIndexers = new Set(group.torrents.map((t) => t.indexerId));

      if (uniqueIndexers.size >= minIndexers) {
        await this.logsService.info("torrent", `Discovered: "${group.sceneTitle}"`, {
          groupTitle: group.sceneTitle,
          torrentCount: group.torrents.length,
          indexerCount: uniqueIndexers.size,
          entityType,
          entityId: entity.id,
          entityName: entity.name,
        });

        discoveredCount++;
      }
    }

    await this.logsService.info("torrent", `Discovery Phase Complete`, {
      totalUnmatched: unmatchedGroups.length,
      discovered: discoveredCount,
    });
  }

  /**
   * Get candidate scenes for matching
   * Returns only the scenes linked to the subscribed performer/studio
   */
  async getCandidateScenes(
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<SceneMetadata[]> {
    if (entityType === "performer") {
      return await this.repository.findPerformerScenes(entityId);
    } else {
      return await this.repository.findStudioScenes(entityId);
    }
  }

  /**
   * Fetch candidate scenes for matching (optimized query)
   */
  private async fetchCandidateScenes(
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<SceneMetadata[]> {
    if (entityType === "performer") {
      return await this.repository.findPerformerScenes(entityId);
    } else {
      return await this.repository.findStudioScenes(entityId);
    }
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Match torrents to a single scene using Cross-Encoder AI
   * Used for scene subscriptions to ensure only relevant torrents are assigned the correct sceneId
   *
   * This method creates MatchedScene results for torrents that match the scene above threshold
   *
   * @param torrents - Array of torrent results to filter
   * @param scene - The scene to match against (must have proper metadata)
   * @param threshold - Optional minimum match score (defaults to 0.7)
   * @returns MatchResult with matched/unmatched torrents
   */
  async matchTorrentsToSingleScene(
    torrents: TorrentResult[],
    scene: SceneMetadata,
    threshold?: number
  ): Promise<MatchResult> {
    const minThreshold = threshold ?? 0.7;

    await this.logsService.info(
      "torrent",
      `Matching ${torrents.length} torrents to single scene: "${scene.title}"`,
      { sceneId: scene.id, threshold: minThreshold }
    );

    const matched: Array<{ scene: SceneMetadata; torrents: TorrentResult[] }> = [];
    const unmatched: SceneGroup[] = [];

    // Load Cross-Encoder once for all torrents
    await this.crossEncoderService.initialize();

    try {
      for (const torrent of torrents) {
        // Clean scene title from torrent title for matching
        const cleanedTitle = this.cleanEntityNameFromTitle(
          torrent.title,
          scene.title,
          "studio" // Treat scene title as "studio" name for cleaning
        );

        // Find best match using Cross-Encoder
        const crossEncoderMatch = await this.crossEncoderService.findBestMatch(
          {
            performer: undefined,
            studio: undefined,
            title: scene.title,
          },
          [{
            id: scene.id,
            title: cleanedTitle,
            date: scene.date,
            studio: scene.studioName,
            performers: scene.performerNames,
          }],
          minThreshold
        );

        if (crossEncoderMatch && crossEncoderMatch.candidate.id === scene.id) {
          // Torrent matches this scene
          matched.push({
            scene,
            torrents: [torrent],
          });

          await this.logsService.info(
            "torrent",
            `✓ Matched "${torrent.title}" to "${scene.title}"`,
            {
              score: crossEncoderMatch.score,
              threshold: minThreshold,
            }
          );
        } else {
          // Torrent does not match this scene
          unmatched.push({
            sceneTitle: torrent.title,
            torrents: [torrent],
          });

          await this.logsService.info(
            "torrent",
            `✗ Rejected "${torrent.title}" (score: ${crossEncoderMatch?.score ?? 0} < ${minThreshold})`,
            { sceneTitle: scene.title }
          );
        }
      }

      await this.logsService.info(
        "torrent",
        `Single scene matching complete: ${matched.length} matched, ${unmatched.length} rejected`,
        {
          sceneId: scene.id,
          sceneTitle: scene.title,
          matched: matched.length,
          rejected: unmatched.length,
        }
      );

      return { matched, unmatched };
    } finally {
      // Always unload Cross-Encoder
      this.crossEncoderService.unload();
    }
  }
}
