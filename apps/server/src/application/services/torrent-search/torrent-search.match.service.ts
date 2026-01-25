/**
 * Torrent Search Match Service
 * Handles scene matching with AI support
 *
 * Responsibilities:
 * - Scene matching (both legacy and Cross-Encoder)
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
   */
  async matchWithMetadata(
    groups: SceneGroup[],
    entityType: "performer" | "studio",
    entity: { id: string; name: string; aliases?: string[] }
  ): Promise<MatchResult> {
    // Check if Cross-Encoder is enabled
    const settings = await this.settingsService.getSettings();
    const useCrossEncoder = settings.ai.useCrossEncoder;

    // If Cross-Encoder is enabled, use the new matching logic
    if (useCrossEncoder) {
      await this.logsService.info(
        "torrent",
        "Using Cross-Encoder for scene matching",
        {
          threshold: settings.ai.crossEncoderThreshold,
        }
      );

      return await this.matchWithCrossEncoder(groups, entity, entityType);
    }

    // Legacy matching path
    return await this.matchWithLegacy(groups, entityType, entity.id);
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
   * Cross-Encoder matching
   */
  async matchWithCrossEncoder(
    groups: SceneGroup[],
    entity: { id: string; name: string },
    entityType: "performer" | "studio"
  ): Promise<MatchResult> {
    const settings = await this.settingsService.getSettings();
    const threshold = settings.ai.crossEncoderThreshold || 0.7;

    // Load model once at the start for all matches
    await this.logsService.info(
      "torrent",
      `Loading Cross-Encoder model once for ${groups.length} groups`
    );
    await this.crossEncoderService.initialize();

    try {
      return await this.performCrossEncoderMatching(
        groups,
        entity,
        entityType,
        threshold
      );
    } finally {
      // Unload model after all matches complete
      await this.logsService.info(
        "torrent",
        `Unloading Cross-Encoder model after matching ${groups.length} groups`
      );
      this.crossEncoderService.unload();
    }
  }

  /**
   * Perform the actual Cross-Encoder matching logic
   */
  private async performCrossEncoderMatching(
    groups: SceneGroup[],
    entity: { id: string; name: string },
    entityType: "performer" | "studio",
    threshold: number
  ): Promise<MatchResult> {
    // Get candidate scenes from database
    const candidateScenes = await this.getCandidateScenes(entityType, entity.id);

    const matched: Array<{ scene: SceneMetadata; torrents: TorrentResult[] }> = [];
    const unmatched: SceneGroup[] = [];
    const matchedSceneIds = new Set<string>();

    await this.logsService.info(
      "torrent",
      `Cross-Encoder Matching Started`,
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

      // Clean performer/studio names from title
      let cleanedTitle = this.cleanEntityNameFromTitle(
        group.sceneTitle,
        entity.name,
        entityType
      );

      // Construct query with multi-signal information
      const query = {
        performer: entityType === "performer" ? entity.name : undefined,
        studio: entityType === "studio" ? entity.name : undefined,
        title: cleanedTitle,
      };

      // Find best match using Cross-Encoder
      const match = await this.crossEncoderService.findBestMatch(
        query,
        availableScenes.map((s) => ({
          id: s.id,
          title: s.title,
          date: s.date || undefined,
          studio: s.studioName,
          performers: s.performerNames,
        })),
        threshold
      );

      if (match) {
        const scene = candidateScenes.find((s) => s.id === match.candidate.id)!;
        matchedSceneIds.add(scene.id);

        // Store AI score for debugging
        await this.aiMatchScoresRepository.create({
          sceneId: scene.id,
          torrentTitle: group.sceneTitle,
          score: match.score,
          method: "cross-encoder",
          model: this.crossEncoderService.getModelName(),
          threshold,
          matched: true,
        });

        // Attach sceneId to all torrents in this group
        for (const torrent of group.torrents) {
          torrent.sceneId = scene.id;
        }

        matched.push({ scene, torrents: group.torrents });
      } else {
        unmatched.push(group);
      }
    }

    return { matched, unmatched };
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
}
