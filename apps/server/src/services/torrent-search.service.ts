/**
 * Torrent Search Service
 * Handles torrent searching with detailed logging for debugging
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "@repo/database";
import { createLogsService } from "./logs.service.js";
import { createSettingsService } from "./settings.service.js";
import { createAIMatchingService } from "./ai-matching.service.js";
import { eq } from "drizzle-orm";
import {
  performers,
  studios,
  scenes,
  qualityProfiles,
  performersScenes,
  studiosScenes,
} from "@repo/database";

interface TorrentResult {
  title: string;
  size: number;
  seeders: number;
  quality: string;
  source: string;
  indexerId: string;
  indexerName: string;
  downloadUrl: string;
  infoHash: string;
  sceneId?: string; // Optional: set when matched with a database scene
}

interface SceneMetadata {
  id: string;
  title: string;
  date?: string;
  performerIds: string[];
  studioId?: string;
}

export class TorrentSearchService {
  private logsService;
  private settingsService;
  private aiMatchingService;

  constructor(private db: BetterSQLite3Database<typeof schema>) {
    this.logsService = createLogsService(db);
    this.settingsService = createSettingsService(db);
    this.aiMatchingService = createAIMatchingService();
  }

  /**
   * Main torrent search workflow with detailed logging
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
      // Step 1: Search Phase
      const rawResults = await this.performSearch(
        entityType,
        entityId,
        includeAliases,
        indexerIds
      );

      // Step 2: Hard Filtering (Name Integrity)
      const filteredResults = await this.applyHardFilters(
        rawResults,
        entityType,
        entityId
      );

      // Step 3: Group by Scene
      const groupedResults = await this.groupByScene(filteredResults);

      // Step 4: Match against Database Metadata
      const { matched, unmatched } = await this.matchWithMetadata(
        groupedResults,
        entityType,
        entityId
      );

      // Step 5: Process Matched Results (with quality selection)
      const matchedTorrents = await this.processMatchedResults(
        matched,
        qualityProfileId,
        entityType,
        entityId
      );

      // Step 6: Process Unmatched Results (metadata-less scenes)
      const unmatchedTorrents = includeMetadataMissing
        ? await this.processUnmatchedResults(
            unmatched,
            qualityProfileId,
            entityType,
            entityId
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
        },
        entityType === "performer"
          ? { performerId: entityId }
          : { studioId: entityId }
      );

      return allSelectedTorrents;
    } catch (error) {
      await this.logsService.error(
        "torrent",
        `Torrent search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { error: error instanceof Error ? error.stack : String(error) },
        entityType === "performer"
          ? { performerId: entityId }
          : { studioId: entityId }
      );
      throw error;
    }
  }

  /**
   * Step 1: Search indexers for performer/studio
   */
  private async performSearch(
    entityType: "performer" | "studio",
    entityId: string,
    includeAliases: boolean,
    _indexerIds: string[]
  ): Promise<TorrentResult[]> {
    const results: TorrentResult[] = [];

    // Get entity details
    let entity: any = null;
    let searchTerms: string[] = [];

    if (entityType === "performer") {
      entity = await this.db.query.performers.findFirst({
        where: eq(performers.id, entityId),
      });
      if (entity) {
        searchTerms.push(entity.name);
        if (includeAliases && entity.aliases && entity.aliases.length > 0) {
          searchTerms.push(...entity.aliases);
        }
      }
    } else {
      entity = await this.db.query.studios.findFirst({
        where: eq(studios.id, entityId),
      });
      if (entity) {
        searchTerms.push(entity.name);
        if (includeAliases && entity.aliases && entity.aliases.length > 0) {
          searchTerms.push(...entity.aliases);
        }
      }
    }

    if (!entity) {
      await this.logsService.warning("torrent", `Entity not found for search`, {
        entityType,
        entityId,
      });
      return results;
    }

    // Get Prowlarr settings from database
    const settings = await this.settingsService.getSettings();
    const prowlarrConfig = settings.prowlarr;

    if (
      !prowlarrConfig.enabled ||
      !prowlarrConfig.apiUrl ||
      !prowlarrConfig.apiKey
    ) {
      return results;
    }

    const prowlarrUrl = prowlarrConfig.apiUrl;
    const prowlarrApiKey = prowlarrConfig.apiKey;

    // Search Prowlarr for each search term
    for (const term of searchTerms) {
      try {
        const response = await fetch(
          `${prowlarrUrl}/api/v1/search?query=${encodeURIComponent(term)}&type=search&limit=1000`,
          {
            headers: {
              "X-Api-Key": prowlarrApiKey,
            },
          }
        );

        if (!response.ok) {
          await this.logsService.warning(
            "torrent",
            `Prowlarr search failed for term "${term}"`,
            { term, status: response.status }
          );
          continue;
        }

        const prowlarrResults = await response.json() as Array<{
          title: string;
          size?: number;
          seeders?: number;
          indexerId?: number;
          indexer?: string;
          downloadUrl?: string;
          magnetUrl?: string;
          infoHash?: string;
        }>;

        // Convert Prowlarr results to our format
        for (const result of prowlarrResults) {
          // Convert Prowlarr indexerId to our database format: prowlarr-{id}
          const dbIndexerId = result.indexerId
            ? `prowlarr-${result.indexerId}`
            : "";

          results.push({
            title: result.title,
            size: result.size || 0,
            seeders: result.seeders || 0,
            quality: this.detectQuality(result.title),
            source: this.detectSource(result.title),
            indexerId: dbIndexerId,
            indexerName: result.indexer || "Unknown",
            downloadUrl: result.downloadUrl || result.magnetUrl || "",
            infoHash: result.infoHash || "",
          });
        }

        await this.logsService.info(
          "torrent",
          `Prowlarr returned ${prowlarrResults.length} results for "${term}"`,
          { term, resultCount: prowlarrResults.length }
        );
      } catch (error) {
        await this.logsService.error(
          "torrent",
          `Failed to search Prowlarr for "${term}": ${error instanceof Error ? error.message : "Unknown error"}`,
          { term, error: error instanceof Error ? error.stack : String(error) }
        );
      }
    }

    await this.logsService.info(
      "torrent",
      `Total Prowlarr results: ${results.length}`,
      { totalResults: results.length, searchTerms: searchTerms.length }
    );

    return results;
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

  /**
   * Step 2: Apply hard filters (name integrity)
   * Eliminates false matches like "jade kush" when searching "jade harper"
   */
  private async applyHardFilters(
    results: TorrentResult[],
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<TorrentResult[]> {
    // Get entity details
    let entity: any = null;
    let allowedNames: string[] = [];

    if (entityType === "performer") {
      entity = await this.db.query.performers.findFirst({
        where: eq(performers.id, entityId),
      });
      if (entity) {
        allowedNames.push(entity.name.toLowerCase());
        if (entity.aliases && entity.aliases.length > 0) {
          allowedNames.push(
            ...entity.aliases.map((a: string) => a.toLowerCase())
          );
        }
      }
    } else {
      entity = await this.db.query.studios.findFirst({
        where: eq(studios.id, entityId),
      });
      if (entity) {
        allowedNames.push(entity.name.toLowerCase());
        if (entity.aliases && entity.aliases.length > 0) {
          allowedNames.push(
            ...entity.aliases.map((a: string) => a.toLowerCase())
          );
        }
      }
    }

    if (!entity) {
      return results;
    }

    // Filter torrents that contain the exact name (not just partial match)
    const filtered = results.filter((result) => {
      const titleLower = result.title.toLowerCase();

      // Check if any allowed name appears in the title
      return allowedNames.some((name) => {
        const words = name.split(/\s+/);

        // For single-word names, use simple word boundary matching
        if (words.length === 1) {
          const regex = new RegExp(
            `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
            "i"
          );
          return regex.test(titleLower);
        }

        // For multi-word names, ensure words appear in order with max 2 words between
        // Example: "jade harper" should match "jade harper" or "jade nicole harper"
        // but NOT "jade kush ... dillion harper"
        const escapedWords = words.map((w) =>
          w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        );

        // Build pattern: word1(\s+\w+){0,2}\s+word2(\s+\w+){0,2}\s+word3...
        let pattern = `\\b${escapedWords[0]}`;
        for (let i = 1; i < escapedWords.length; i++) {
          pattern += `(\\s+\\w+){0,2}\\s+${escapedWords[i]}`;
        }
        pattern += `\\b`;

        const regex = new RegExp(pattern, "i");
        return regex.test(titleLower);
      });
    });

    const eliminated = results.length - filtered.length;
    if (eliminated > 0) {
      await this.logsService.info(
        "torrent",
        `Eliminated ${eliminated} false matches during filtering for ${entity.name}`,
        {
          entityName: entity.name,
          before: results.length,
          after: filtered.length,
          eliminated,
        }
      );
    }

    return filtered;
  }

  /**
   * Step 3: Group results by scene with two-phase matching
   * Phase 1: Strict regex-based grouping (exact + prefix match)
   * Phase 2: AI-based merging of similar groups (if AI is enabled, with high threshold)
   */
  private async groupByScene(
    results: TorrentResult[]
  ): Promise<Array<{ sceneTitle: string; torrents: TorrentResult[] }>> {
    // Get grouping threshold from settings
    const settings = await this.settingsService.getSettings();
    const groupingThreshold = settings.general.groupingThreshold || 0.7;

    // PHASE 1: Strict regex-based grouping
    const phase1Groups = new Map<string, TorrentResult[]>();

    for (const result of results) {
      // Extract scene title by removing quality, source, and common metadata
      const sceneTitle = this.extractSceneTitle(result.title);

      // Skip if title is too short or generic
      if (sceneTitle.length < 15) {
        // Too short, create separate group
        if (!phase1Groups.has(sceneTitle)) {
          phase1Groups.set(sceneTitle, []);
        }
        phase1Groups.get(sceneTitle)!.push(result);
        continue;
      }

      // Check if this title matches any existing group (strict rules only)
      let matchedGroupKey: string | null = null;

      for (const existingKey of phase1Groups.keys()) {
        // Skip if existing key is too short
        if (existingKey.length < 15) {
          continue;
        }

        // 1. Exact match
        if (existingKey === sceneTitle) {
          matchedGroupKey = existingKey;
          break;
        }

        // 2. Truncated prefix matching (very conservative)
        const shorter =
          sceneTitle.length < existingKey.length ? sceneTitle : existingKey;
        const longer =
          sceneTitle.length < existingKey.length ? existingKey : sceneTitle;

        // Must be at least 30 chars to consider prefix matching
        if (shorter.length >= 30 && longer.startsWith(shorter)) {
          const ratio = shorter.length / longer.length;

          if (ratio >= groupingThreshold) {
            // Use the longer, more complete title as the group key
            if (longer === existingKey) {
              matchedGroupKey = existingKey;
            } else {
              // Merge existing group into new longer title
              const existingTorrents = phase1Groups.get(existingKey)!;
              phase1Groups.delete(existingKey);
              matchedGroupKey = longer;
              phase1Groups.set(matchedGroupKey, existingTorrents);
            }
            break;
          }
        }
      }

      // Add to matched group or create new group
      const groupKey = matchedGroupKey || sceneTitle;
      if (!phase1Groups.has(groupKey)) {
        phase1Groups.set(groupKey, []);
      }
      phase1Groups.get(groupKey)!.push(result);
    }

    // Convert Phase 1 groups to array format
    let groupedResults = Array.from(phase1Groups.entries()).map(
      ([sceneTitle, torrents]) => ({
        sceneTitle,
        torrents,
      })
    );

    // PHASE 2: AI-based group merging (only if AI is enabled)
    const aiEnabled = settings.ai.enabled;

    if (aiEnabled && groupedResults.length > 1) {
      try {
        await this.aiMatchingService.initialize();

        // Very high threshold for group merging (0.92) to prevent false positives
        const AI_MERGE_THRESHOLD = 0.92;

        // Track which groups have been merged
        const mergedIndices = new Set<number>();
        const mergedGroups: Array<{
          sceneTitle: string;
          torrents: TorrentResult[];
        }> = [];

        for (let i = 0; i < groupedResults.length; i++) {
          if (mergedIndices.has(i)) continue;

          const currentGroup = groupedResults[i];
          const mergedTorrents = [...currentGroup.torrents];
          let mergedTitle = currentGroup.sceneTitle;

          // Compare with all following groups
          for (let j = i + 1; j < groupedResults.length; j++) {
            if (mergedIndices.has(j)) continue;

            const otherGroup = groupedResults[j];

            // Skip if titles are too short
            if (
              currentGroup.sceneTitle.length < 30 ||
              otherGroup.sceneTitle.length < 30
            ) {
              continue;
            }

            // Additional validation: Check if they share similar performer names
            const currentPerformers = this.extractPerformerNames(
              currentGroup.sceneTitle
            );
            const otherPerformers = this.extractPerformerNames(
              otherGroup.sceneTitle
            );

            // If both have performers but they're completely different, skip AI check
            if (currentPerformers.length > 0 && otherPerformers.length > 0) {
              const hasCommonPerformer = currentPerformers.some((p1) =>
                otherPerformers.some(
                  (p2) => p1.toLowerCase() === p2.toLowerCase()
                )
              );

              if (!hasCommonPerformer) {
                continue;
              }
            }

            try {
              const aiSimilarity =
                await this.aiMatchingService.calculateSimilarity(
                  currentGroup.sceneTitle.toLowerCase(),
                  otherGroup.sceneTitle.toLowerCase()
                );

              if (aiSimilarity >= AI_MERGE_THRESHOLD) {
                // Merge the groups
                mergedTorrents.push(...otherGroup.torrents);
                mergedIndices.add(j);

                // Use the longer title
                if (otherGroup.sceneTitle.length > mergedTitle.length) {
                  mergedTitle = otherGroup.sceneTitle;
                }

                await this.logsService.info(
                  "torrent",
                  `AI merged groups: "${currentGroup.sceneTitle}" + "${otherGroup.sceneTitle}"`,
                  {
                    similarity: aiSimilarity,
                    threshold: AI_MERGE_THRESHOLD,
                    resultTitle: mergedTitle,
                    torrentCount: mergedTorrents.length,
                  }
                );
              }
            } catch (error) {
              console.error(`[AI Merge] Error comparing groups:`, error);
            }
          }

          // Add the merged group
          mergedGroups.push({
            sceneTitle: mergedTitle,
            torrents: mergedTorrents,
          });
        }

        groupedResults = mergedGroups;
      } catch (error) {
        await this.logsService.warning(
          "torrent",
          "AI group merging failed, using Phase 1 results only",
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    }

    await this.logsService.info(
      "torrent",
      `Grouped ${results.length} torrents into ${groupedResults.length} scene groups`,
      {
        totalTorrents: results.length,
        sceneGroups: groupedResults.length,
        aiEnabled,
        groups: groupedResults.map((g) => ({
          title: g.sceneTitle,
          torrentCount: g.torrents.length,
          qualities: [...new Set(g.torrents.map((t) => t.quality))].join(", "),
          indexers: [...new Set(g.torrents.map((t) => t.indexerName))].join(
            ", "
          ),
          originalTitles: g.torrents.map((t) => t.title),
        })),
      }
    );

    return groupedResults;
  }

  /**
   * Extract potential performer names from scene title
   * Used for validation before AI merging
   */
  private extractPerformerNames(title: string): string[] {
    // Remove common words and split by common separators
    // Reserved for future enhanced name extraction
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _cleaned = title
      .toLowerCase()
      .replace(/\b(and|with|the|in|on|at|from|to|for|of|a|an)\b/g, "")
      .trim();

    // Look for capitalized words which are likely names
    const words = title.split(/[\s,\-&]+/).filter((w) => w.length > 2);

    // Return words that start with capital letter (likely names)
    return words.filter((w) => /^[A-Z]/.test(w));
  }

  /**
   * Extract scene title from torrent title by removing metadata
   */
  private extractSceneTitle(title: string): string {
    // Remove common patterns: quality, source, codec, group, etc.
    let cleaned = title;

    // Remove everything after common spam indicators
    cleaned = cleaned.replace(
      /\s+(want more|watch and download|get of accounts|backup\/latest|to watch video|#hd|#in).*/gi,
      ""
    );

    // Remove telegram links
    cleaned = cleaned.replace(/t\.me\/[^\s]+/gi, "");

    // Remove URLs (http://, https://, ftp://, or domain-like patterns)
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, "");
    cleaned = cleaned.replace(/ftp:\/\/[^\s]+/gi, "");
    cleaned = cleaned.replace(/www\.[^\s]+/gi, "");
    cleaned = cleaned.replace(
      /[a-z0-9-]+\.(com|net|org|io|to|cc|tv|xxx|html)[^\s]*/gi,
      ""
    );

    // Remove common streaming/download sites
    cleaned = cleaned.replace(
      /\b(savefiles|lulustream|doodstream|streamtape|bigwarp)\.[\w\/]+/gi,
      ""
    );

    // Remove arrow symbols and common spam indicators
    cleaned = cleaned.replace(/[-=]>/g, " ");
    cleaned = cleaned.replace(/<[-=]/g, " ");
    cleaned = cleaned.replace(/\\r\\n|\\n/g, " ");

    // Remove platform prefixes (OnlyFans, ManyVids, etc.)
    cleaned = cleaned.replace(
      /\b(onlyfans|manyvids|fansly|patreon|fancentro|pornhub|xvideos|chaturbate|cam4|myfreecams|mfc|streamate|mrluckyraw|tagteampov|baddiesonlypov)[-\s]*/gi,
      ""
    );

    // Remove spam keywords
    cleaned = cleaned.replace(
      /\b(new|full|xxx|nsfw|leaked|exclusive|premium|vip|hot|sexy|latest|hd|rq)\b/gi,
      ""
    );

    // Remove date patterns (DD MM YY, YYYY MM DD, 25 10 10, etc.)
    cleaned = cleaned.replace(/\b\d{2}\s+\d{2}\s+\d{2}\b/g, "");
    cleaned = cleaned.replace(/\b\d{4}\s+\d{2}\s+\d{2}\b/g, "");
    cleaned = cleaned.replace(/\b(19|20)\d{2}[-_.]\d{2}[-_.]\d{2}\b/g, "");
    cleaned = cleaned.replace(/\b(19|20)\d{2}\b/g, ""); // Remove year

    // Remove quality indicators
    cleaned = cleaned.replace(/\b(2160p|1080p|720p|480p|4k|uhd|hd|sd)\b/gi, "");

    // Remove source indicators
    cleaned = cleaned.replace(
      /\b(web-?dl|webrip|bluray|blu-ray|hdtv|dvdrip|bdrip|brrip)\b/gi,
      ""
    );

    // Remove codec indicators
    cleaned = cleaned.replace(
      /\b(h\.?264|h\.?265|x264|x265|hevc|avc|mpeg|divx|xvid)\b/gi,
      ""
    );

    // Remove audio indicators
    cleaned = cleaned.replace(
      /\b(aac|ac3|dts|flac|mp3|dd5\.1|dd2\.0|atmos)\b/gi,
      ""
    );

    // Remove file formats
    cleaned = cleaned.replace(
      /\b(mp4|mkv|avi|wmv|mov|flv|m4v|ts|mpg|mpeg)\b/gi,
      ""
    );

    // Remove release group (usually in brackets or parentheses)
    cleaned = cleaned.replace(/\[.*?\]/g, "");
    cleaned = cleaned.replace(/\(.*?\)/g, "");

    // Remove file size indicators
    cleaned = cleaned.replace(/\b\d+(\.\d+)?\s?(gb|mb|gib|mib)\b/gi, "");

    // Remove scene numbering patterns (E55, S01E02, etc.)
    cleaned = cleaned.replace(/\b(s\d{2}e\d{2}|e\d{2,3})\b/gi, "");

    // Remove common release tags
    cleaned = cleaned.replace(
      /\b(repack|proper|real|retail|extended|unrated|directors?\.cut|remastered|xleech|p2p|xc)\b/gi,
      ""
    );

    // Remove escaped quotes
    cleaned = cleaned.replace(/\\"/g, '"');

    // Remove multiple dashes, underscores, dots
    cleaned = cleaned.replace(/[-_.]{2,}/g, " ");

    // Clean up extra spaces and trim
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    // Remove leading/trailing special characters
    cleaned = cleaned.replace(/^[-_.,"]+|[-_.,"]+$/g, "");

    return cleaned || title; // Fallback to original if cleaning resulted in empty string
  }

  /**
   * Step 4: Match grouped results with database metadata
   */
  private async matchWithMetadata(
    groups: Array<{ sceneTitle: string; torrents: TorrentResult[] }>,
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<{
    matched: Array<{ scene: SceneMetadata; torrents: TorrentResult[] }>;
    unmatched: Array<{ sceneTitle: string; torrents: TorrentResult[] }>;
  }> {
    const matched: Array<{ scene: SceneMetadata; torrents: TorrentResult[] }> =
      [];
    const unmatched: Array<{ sceneTitle: string; torrents: TorrentResult[] }> =
      [];

    // Get scenes for this entity (limit to prevent memory issues)
    let entityScenes: any[] = [];
    const MAX_SCENES_TO_MATCH = 500; // Prevent loading thousands of scenes

    if (entityType === "performer") {
      const performerSceneRecords =
        await this.db.query.performersScenes.findMany({
          where: eq(performersScenes.performerId, entityId),
          limit: MAX_SCENES_TO_MATCH,
        });

      const sceneIds = performerSceneRecords.map((ps) => ps.sceneId);

      // Fetch scenes in batches to prevent memory spike
      const batchSize = 50;
      for (let i = 0; i < sceneIds.length; i += batchSize) {
        const batch = sceneIds.slice(i, i + batchSize);
        const batchScenes = await Promise.all(
          batch.map((sceneId) =>
            this.db.query.scenes.findFirst({
              where: eq(scenes.id, sceneId),
            })
          )
        );
        entityScenes.push(...batchScenes.filter(Boolean));
      }
    } else {
      const studioSceneRecords = await this.db.query.studiosScenes.findMany({
        where: eq(studiosScenes.studioId, entityId),
        limit: MAX_SCENES_TO_MATCH,
      });

      const sceneIds = studioSceneRecords.map((ss) => ss.sceneId);

      // Fetch scenes in batches to prevent memory spike
      const batchSize = 50;
      for (let i = 0; i < sceneIds.length; i += batchSize) {
        const batch = sceneIds.slice(i, i + batchSize);
        const batchScenes = await Promise.all(
          batch.map((sceneId) =>
            this.db.query.scenes.findFirst({
              where: eq(scenes.id, sceneId),
            })
          )
        );
        entityScenes.push(...batchScenes.filter(Boolean));
      }
    }

    // Get AI settings
    const settings = await this.settingsService.getSettings();
    const aiEnabled = settings.ai.enabled;
    const aiThreshold = settings.ai.threshold;

    // Initialize AI model if enabled
    if (aiEnabled) {
      try {
        await this.aiMatchingService.initialize();
        await this.logsService.info(
          "torrent",
          "AI matching enabled for scene matching",
          { model: settings.ai.model, threshold: aiThreshold }
        );
      } catch (error) {
        await this.logsService.warning(
          "torrent",
          "Failed to initialize AI matching, falling back to Levenshtein",
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    }

    // Track which scenes have already been matched to prevent duplicates
    const matchedSceneIds = new Set<string>();

    // Try to match each group with a scene
    for (const group of groups) {
      let matchedScene: any = null;
      let matchMethod = "none";
      let matchScore = 0;

      // Try fuzzy matching with scene titles
      for (const scene of entityScenes) {
        // Skip if this scene was already matched to another group
        if (matchedSceneIds.has(scene.id)) {
          continue;
        }

        const groupTitle = group.sceneTitle.toLowerCase();
        const sceneTitle = scene.title.toLowerCase();

        // Try AI matching first if enabled
        if (aiEnabled) {
          try {
            const aiSimilarity =
              await this.aiMatchingService.calculateSimilarity(
                groupTitle,
                sceneTitle
              );

            if (aiSimilarity >= aiThreshold) {
              matchedScene = scene;
              matchMethod = "ai";
              matchScore = aiSimilarity;
              matchedSceneIds.add(scene.id);
              break;
            }
          } catch (error) {
            // Fall through to traditional matching if AI fails
            console.error("[TorrentSearch] AI matching failed:", error);
          }
        }

        // Fall back to traditional Levenshtein + truncated matching
        const similarity = this.calculateSimilarity(groupTitle, sceneTitle);

        // Check for truncated title match (one string starts with the other)
        const isTruncated =
          groupTitle.startsWith(sceneTitle) ||
          sceneTitle.startsWith(groupTitle);

        // Check if shorter string is substantially contained in longer string (for truncated titles)
        const shorter =
          groupTitle.length < sceneTitle.length ? groupTitle : sceneTitle;
        const longer =
          groupTitle.length < sceneTitle.length ? sceneTitle : groupTitle;
        const isPartialMatch =
          shorter.length > 20 && longer.startsWith(shorter);

        // If similarity is high enough OR it's a truncated match, consider it a match
        if (similarity > 0.7 || isTruncated || isPartialMatch) {
          matchedScene = scene;
          matchMethod =
            isTruncated || isPartialMatch ? "truncated" : "levenshtein";
          matchScore = similarity;
          matchedSceneIds.add(scene.id); // Mark this scene as matched
          break;
        }
      }

      if (matchedScene) {
        // Get performer and studio IDs for this scene
        const performerSceneRecords =
          await this.db.query.performersScenes.findMany({
            where: eq(performersScenes.sceneId, matchedScene.id),
          });
        const performerIds = performerSceneRecords.map((ps) => ps.performerId);

        const studioSceneRecords = await this.db.query.studiosScenes.findMany({
          where: eq(studiosScenes.sceneId, matchedScene.id),
        });
        const studioId =
          studioSceneRecords.length > 0
            ? studioSceneRecords[0].studioId
            : undefined;

        matched.push({
          scene: {
            id: matchedScene.id,
            title: matchedScene.title,
            date: matchedScene.date,
            performerIds,
            studioId,
          },
          torrents: group.torrents,
        });

        // Log match details
        await this.logsService.info(
          "torrent",
          `Matched "${group.sceneTitle}" to "${matchedScene.title}" using ${matchMethod}`,
          {
            method: matchMethod,
            score: matchScore,
            groupTitle: group.sceneTitle,
            sceneTitle: matchedScene.title,
          }
        );
      } else {
        unmatched.push(group);
      }
    }

    if (matched.length > 0 || unmatched.length > 0) {
      await this.logsService.info(
        "torrent",
        `Matched ${matched.length} scenes, ${unmatched.length} unmatched`,
        {
          matched: matched.length,
          unmatched: unmatched.length,
          aiEnabled,
        }
      );
    }

    return { matched, unmatched };
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
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
   * Step 5: Process matched results (select best quality based on profile)
   */
  private async processMatchedResults(
    matched: Array<{ scene: SceneMetadata; torrents: TorrentResult[] }>,
    qualityProfileId: string,
    _entityType: "performer" | "studio",
    _entityId: string
  ): Promise<TorrentResult[]> {
    const selectedTorrents: TorrentResult[] = [];

    for (const match of matched) {
      const bestTorrent = await this.selectBestTorrent(
        match.torrents,
        qualityProfileId
      );

      if (bestTorrent) {
        // Attach scene ID to the torrent result
        bestTorrent.sceneId = match.scene.id;
        selectedTorrents.push(bestTorrent);

        await this.logsService.info(
          "torrent",
          `Selected torrent for scene "${match.scene.title}"`,
          {
            sceneId: match.scene.id,
            sceneTitle: match.scene.title,
            selectedQuality: bestTorrent.quality,
            selectedSource: bestTorrent.source,
            seeders: bestTorrent.seeders,
          },
          { sceneId: match.scene.id }
        );
      } else {
        await this.logsService.warning(
          "torrent",
          `No suitable torrent found for scene "${match.scene.title}"`,
          {
            sceneId: match.scene.id,
            sceneTitle: match.scene.title,
            availableTorrents: match.torrents.length,
          },
          { sceneId: match.scene.id }
        );
      }
    }

    return selectedTorrents;
  }

  /**
   * Step 6: Process unmatched results (save as metadata-less scenes)
   * Only select groups that have minimum required indexers
   */
  private async processUnmatchedResults(
    unmatched: Array<{ sceneTitle: string; torrents: TorrentResult[] }>,
    qualityProfileId: string,
    _entityType: "performer" | "studio",
    _entityId: string
  ): Promise<TorrentResult[]> {
    const selectedTorrents: TorrentResult[] = [];

    // Get minimum indexers setting
    const settings = await this.settingsService.getSettings();
    const minIndexers = settings.general.minIndexersForMetadataLess;

    for (const unmatchedScene of unmatched) {
      // For metadata-less scenes, count ALL unique indexers (not just high-priority ones)
      // This ensures we don't miss scenes just because they're only on lower-priority indexers
      const uniqueIndexers = new Set(
        unmatchedScene.torrents.map((t) => t.indexerId)
      );
      const indexerCount = uniqueIndexers.size;

      // Skip if not enough unique indexers
      if (indexerCount < minIndexers) {
        await this.logsService.info(
          "torrent",
          `Skipping metadata-less scene "${unmatchedScene.sceneTitle}" - insufficient indexers (${indexerCount}/${minIndexers})`,
          {
            sceneTitle: unmatchedScene.sceneTitle,
            indexerCount,
            minIndexers,
          }
        );
        continue;
      }

      // Select best torrent from this group (using all torrents, not just high-priority indexers)
      const bestTorrent = await this.selectBestTorrent(
        unmatchedScene.torrents,
        qualityProfileId
      );

      if (bestTorrent) {
        selectedTorrents.push(bestTorrent);

        await this.logsService.info(
          "torrent",
          `Selected metadata-less scene "${unmatchedScene.sceneTitle}"`,
          {
            sceneTitle: unmatchedScene.sceneTitle,
            indexerCount,
            selectedQuality: bestTorrent.quality,
            selectedSource: bestTorrent.source,
            seeders: bestTorrent.seeders,
          }
        );
      }
    }

    if (selectedTorrents.length > 0) {
      await this.logsService.info(
        "torrent",
        `Selected ${selectedTorrents.length} metadata-less scenes from ${unmatched.length} unmatched`,
        {
          selectedCount: selectedTorrents.length,
          totalUnmatched: unmatched.length,
          minIndexers,
        }
      );
    }

    return selectedTorrents;
  }

  /**
   * Select best torrent based on quality profile
   */
  private async selectBestTorrent(
    torrents: TorrentResult[],
    qualityProfileId: string
  ): Promise<TorrentResult | null> {
    if (torrents.length === 0) {
      return null;
    }

    // Load quality profile
    const profile = await this.db.query.qualityProfiles.findFirst({
      where: eq(qualityProfiles.id, qualityProfileId),
    });

    if (!profile || !profile.items || profile.items.length === 0) {
      // Fallback: return torrent with most seeders
      return torrents.reduce((best, current) =>
        current.seeders > best.seeders ? current : best
      );
    }

    // Try each quality/source combination in preference order (highest to lowest quality)
    for (let i = 0; i < profile.items.length; i++) {
      const item = profile.items[i];

      // Filter torrents matching this quality/source
      const matchingTorrents = torrents.filter((t) => {
        // Check quality match - "any" matches all
        const qualityMatch =
          item.quality === "any" || t.quality === item.quality;

        // Check source match - "any" matches all
        const sourceMatch = item.source === "any" || t.source === item.source;

        // Check seeders requirement
        const minSeeders = item.minSeeders === "any" ? 0 : item.minSeeders;
        const seedersMatch = t.seeders >= minSeeders;

        // Check size requirement (convert GB to bytes)
        // maxSize 0 means unlimited
        const maxSizeBytes =
          item.maxSize > 0
            ? item.maxSize * 1024 * 1024 * 1024
            : Number.MAX_SAFE_INTEGER;
        const sizeMatch = t.size <= maxSizeBytes;

        const matches =
          qualityMatch && sourceMatch && seedersMatch && sizeMatch;

        return matches;
      });

      if (matchingTorrents.length > 0) {
        // Return the one with most seeders
        const best = matchingTorrents.reduce((best, current) =>
          current.seeders > best.seeders ? current : best
        );
        return best;
      }
    }

    // No matching torrent found for any quality profile item
    return null;
  }
}

// Export factory function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTorrentSearchService(db: any) {
  return new TorrentSearchService(db);
}
