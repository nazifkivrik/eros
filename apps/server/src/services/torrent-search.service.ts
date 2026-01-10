/**
 * Torrent Search Service
 * Handles torrent searching with detailed logging for debugging
 */

import type { Database } from "@repo/database";
import type { LogsService } from "./logs.service.js";
import type { SettingsService } from "./settings.service.js";
import type { AIMatchingService } from "./ai-matching.service.js";
import type { CrossEncoderService } from "./cross-encoder-matching.service.js";
import type { AIMatchScoresRepository } from "../infrastructure/repositories/ai-match-scores.repository.js";
import type { TorrentGroupsRepository } from "../infrastructure/repositories/torrent-groups.repository.js";
import { SceneMatcher } from "./matching/scene-matcher.service.js";
import { logger } from "../utils/logger.js";
import type { MatchSettings, SceneMetadata as MatchSceneMetadata } from "./matching/match-types.js";
import { eq, and, or, ne } from "drizzle-orm";
import {
  performers,
  studios,
  scenes,
  qualityProfiles,
  performersScenes,
  subscriptions,
} from "@repo/database";

interface TorrentResult {
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
  sceneId?: string; // Optional: set when matched with a database scene
  // Added for deduplication
  indexers?: string[]; // List of all indexers that have this torrent
  indexerCount?: number; // Number of unique indexers (popularity signal)
}

interface SceneMetadata {
  id: string;
  title: string;
  date: string | null;
  performerIds: string[];
  studioId?: string;
  performerNames?: string[]; // For cross-encoder matching
  studioName?: string; // For cross-encoder matching
}

export class TorrentSearchService {
  private db: Database;
  private logsService: LogsService;
  private settingsService: SettingsService;
  private aiMatchingService: AIMatchingService;
  private crossEncoderService: CrossEncoderService;
  private aiMatchScoresRepository: AIMatchScoresRepository;

  constructor({
    db,
    logsService,
    settingsService,
    aiMatchingService,
    crossEncoderService,
    aiMatchScoresRepository,
  }: {
    db: Database;
    logsService: LogsService;
    settingsService: SettingsService;
    aiMatchingService: AIMatchingService;
    crossEncoderService: CrossEncoderService;
    aiMatchScoresRepository: AIMatchScoresRepository;
  }) {
    this.db = db;
    this.logsService = logsService;
    this.settingsService = settingsService;
    this.aiMatchingService = aiMatchingService;
    this.crossEncoderService = crossEncoderService;
    this.aiMatchScoresRepository = aiMatchScoresRepository;
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

      // Step 1.5: Deduplicate by infoHash (same torrent from multiple indexers)
      const deduplicatedResults = this.deduplicateByInfoHash(rawResults);

      await this.logsService.info(
        "torrent",
        `Deduplicated ${rawResults.length} results to ${deduplicatedResults.length} unique torrents`,
        {
          before: rawResults.length,
          after: deduplicatedResults.length,
          removed: rawResults.length - deduplicatedResults.length,
        },
        entityType === "performer"
          ? { performerId: entityId }
          : { studioId: entityId }
      );

      // Step 2: Hard Filtering (Name Integrity)
      const filteredResults = await this.applyHardFilters(
        deduplicatedResults,
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

      // Step 4.5: Handle Discovery for unmatched (if Cross-Encoder is enabled)
      const settings = await this.settingsService.getSettings();
      if (settings.ai.useCrossEncoder && unmatched.length > 0) {
        // Get entity for discovery
        let entity;
        if (entityType === "performer") {
          entity = await this.db.query.performers.findFirst({
            where: eq(performers.id, entityId),
          });
        } else {
          entity = await this.db.query.studios.findFirst({
            where: eq(studios.id, entityId),
          });
        }

        if (entity) {
          await this.handleDiscovery(
            unmatched,
            entity,
            entityType,
            entityType // phase is same as entityType for now
          );
        }
      }

      // Step 5: Process Matched Results (with quality selection)
      const matchedTorrents = await this.processMatchedResults(
        matched,
        qualityProfileId,
        entityType,
        entityId
      );

      // Step 6: Process Unmatched Results (metadata-less scenes)
      // Both legacy and Cross-Encoder paths now support metadata-less downloads
      // Use groupingCount setting to determine minimum group size for metadata-less scenes
      const minGroupMembers = settings.ai.groupingCount || 2;

      const unmatchedTorrents = includeMetadataMissing
        ? await this.processUnmatchedResults(
            unmatched,
            qualityProfileId,
            entityType,
            entityId,
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
   * Deduplicate torrents by infoHash
   * Same torrent from multiple indexers is merged into one entry with indexerCount
   * Higher indexerCount = more popular/reliable torrent
   */
  private deduplicateByInfoHash(results: TorrentResult[]): TorrentResult[] {
    const hashMap = new Map<string, TorrentResult>();

    for (const torrent of results) {
      // Skip torrents without infoHash (can't deduplicate)
      if (!torrent.infoHash) {
        // Generate a pseudo-hash from title + size for torrents without infoHash
        const pseudoHash = `${torrent.title}-${torrent.size}`;
        if (!hashMap.has(pseudoHash)) {
          hashMap.set(pseudoHash, {
            ...torrent,
            indexers: [torrent.indexerName],
            indexerCount: 1,
          });
        }
        continue;
      }

      const existing = hashMap.get(torrent.infoHash);
      if (existing) {
        // Merge: add indexer to list
        if (!existing.indexers) {
          existing.indexers = [existing.indexerName];
        }
        if (!existing.indexers.includes(torrent.indexerName)) {
          existing.indexers.push(torrent.indexerName);
        }
        existing.indexerCount = existing.indexers.length;

        // Keep the best seed/leech ratio
        if (torrent.seeders > existing.seeders) {
          existing.seeders = torrent.seeders;
          existing.leechers = torrent.leechers;
          existing.downloadUrl = torrent.downloadUrl; // Use the better source
        }
      } else {
        hashMap.set(torrent.infoHash, {
          ...torrent,
          indexers: [torrent.indexerName],
          indexerCount: 1,
        });
      }
    }

    return Array.from(hashMap.values());
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
    // Default grouping threshold (previously from settings.general.groupingThreshold)
    const groupingThreshold = 0.7;

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

    await this.logsService.info(
      "torrent",
      `Grouped ${results.length} torrents into ${groupedResults.length} scene groups`,
      {
        totalTorrents: results.length,
        sceneGroups: groupedResults.length,
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
   * Reserved for future use
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
  /**
   * Match torrent groups with database scenes using improved scoring system
   */
  private async matchWithMetadata(
    groups: Array<{ sceneTitle: string; torrents: TorrentResult[] }>,
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<{
    matched: Array<{ scene: SceneMetadata; torrents: TorrentResult[] }>;
    unmatched: Array<{ sceneTitle: string; torrents: TorrentResult[] }>;
  }> {
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
          model: this.crossEncoderService.getModelName(),
        }
      );

      // Get entity for Cross-Encoder matching
      let entity;
      if (entityType === "performer") {
        entity = await this.db.query.performers.findFirst({
          where: eq(performers.id, entityId),
        });
      } else {
        entity = await this.db.query.studios.findFirst({
          where: eq(studios.id, entityId),
        });
      }

      if (!entity) {
        throw new Error(`Entity not found: ${entityType} ${entityId}`);
      }

      return await this.matchWithCrossEncoder(groups, entity, entityType);
    }

    // 1. Pre-fetch all candidate scenes ONCE (optimized query) - LEGACY PATH
    const candidateScenes = await this.fetchCandidateScenes(entityType, entityId);

    // 2. Get match settings - use default values for legacy matching
    const matchSettings: MatchSettings = {
      aiEnabled: false, // Legacy AI matching disabled
      aiThreshold: 0.7, // Default threshold
      groupingThreshold: 0.7, // Default grouping threshold
      levenshteinThreshold: 0.7, // Default Levenshtein threshold
    };

    // 3. Initialize SceneMatcher
    const matcher = new SceneMatcher({
      aiMatchingService: this.aiMatchingService,
      logsService: this.logsService,
    });

    // 4. Find BEST match for each group (not first match)
    const matched: Array<{ scene: SceneMetadata; torrents: TorrentResult[] }> = [];
    const unmatched: Array<{ sceneTitle: string; torrents: TorrentResult[] }> = [];
    const matchedSceneIds = new Set<string>();

    for (const group of groups) {
      // Filter out already-matched scenes
      const availableScenes = candidateScenes.filter(
        (s) => !matchedSceneIds.has(s.id)
      );

      // Find best match using new scoring system
      const matchResult = await matcher.findBestMatch(
        group.sceneTitle,
        availableScenes,
        matchSettings
      );

      if (matchResult) {
        matchedSceneIds.add(matchResult.scene.id);

        // Get performer IDs for this scene
        const performerSceneRecords =
          await this.db.query.performersScenes.findMany({
            where: eq(performersScenes.sceneId, matchResult.scene.id),
          });
        const performerIds = performerSceneRecords.map((ps) => ps.performerId);

        matched.push({
          scene: {
            id: matchResult.scene.id,
            title: matchResult.scene.title,
            date: matchResult.scene.date,
            performerIds,
            studioId: matchResult.scene.studioId || undefined,
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
            groupTitle: group.sceneTitle,
            sceneTitle: matchResult.scene.title,
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
          aiEnabled: matchSettings.aiEnabled,
        }
      );
    }

    return { matched, unmatched };
  }

  /**
   * Fetch candidate scenes for matching (optimized single query)
   */
  private async fetchCandidateScenes(
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<MatchSceneMetadata[]> {
    const MAX_SCENES = 500;

    if (entityType === "performer") {
      // Single JOIN query instead of batching
      const results = await this.db
        .select({
          id: scenes.id,
          title: scenes.title,
          date: scenes.date,
          siteId: scenes.siteId,
        })
        .from(scenes)
        .innerJoin(performersScenes, eq(performersScenes.sceneId, scenes.id))
        .where(eq(performersScenes.performerId, entityId))
        .limit(MAX_SCENES);

      return results.map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        studioId: r.siteId,
      }));
    } else {
      // Simple query for studio
      const results = await this.db.query.scenes.findMany({
        where: eq(scenes.siteId, entityId),
        limit: MAX_SCENES,
        columns: { id: true, title: true, date: true, siteId: true },
      });

      return results.map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        studioId: r.siteId,
      }));
    }
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
   * Only select groups that have minimum required members (from groupingCount setting)
   * Works with both deduplication (indexerCount on torrents) and legacy (unique indexerIds)
   */
  private async processUnmatchedResults(
    unmatched: Array<{ sceneTitle: string; torrents: TorrentResult[] }>,
    qualityProfileId: string,
    _entityType: "performer" | "studio",
    _entityId: string,
    minGroupMembers: number = 2 // Minimum members in a group to be considered metadata-less
  ): Promise<TorrentResult[]> {
    const selectedTorrents: TorrentResult[] = [];

    for (const unmatchedScene of unmatched) {
      // Check if group has minimum required members (torrents)
      // groupingCount setting determines minimum group size for metadata-less scenes
      const groupSize = unmatchedScene.torrents.length;

      if (groupSize < minGroupMembers) {
        await this.logsService.debug(
          "torrent",
          `Skipping metadata-less scene "${unmatchedScene.sceneTitle}" - insufficient group members (${groupSize}/${minGroupMembers})`,
          {
            sceneTitle: unmatchedScene.sceneTitle,
            groupSize,
            minGroupMembers,
          }
        );
        continue;
      }

      // Select best torrent from this group
      // Sort by seeders (higher is better), then by indexerCount (more sources = more reliable)
      const sortedTorrents = [...unmatchedScene.torrents].sort((a, b) => {
        // First by seeders (higher is better)
        if (b.seeders !== a.seeders) return b.seeders - a.seeders;
        // Then by indexerCount (higher is better)
        const countA = a.indexerCount || 1;
        const countB = b.indexerCount || 1;
        return countB - countA;
      });

      const bestTorrent = await this.selectBestTorrent(
        sortedTorrents,
        qualityProfileId
      );

      if (bestTorrent) {
        selectedTorrents.push(bestTorrent);

        await this.logsService.info(
          "torrent",
          `Selected metadata-less scene "${unmatchedScene.sceneTitle}"`,
          {
            sceneTitle: unmatchedScene.sceneTitle,
            groupSize,
            minGroupMembers,
            selectedQuality: bestTorrent.quality,
            selectedSource: bestTorrent.source,
            seeders: bestTorrent.seeders,
            torrentIndexerCount: bestTorrent.indexerCount || 1,
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
          minGroupMembers,
        }
      );
    }

    return selectedTorrents;
  }

  /**
   * Match torrent groups with database scenes using Cross-Encoder
   * Returns matched and unmatched groups
   * Model is loaded once at the start and unloaded at the end (not per match)
   */
  private async matchWithCrossEncoder(
    groups: Array<{ sceneTitle: string; torrents: TorrentResult[] }>,
    entity: any,
    entityType: "performer" | "studio"
  ): Promise<{
    matched: Array<{ scene: SceneMetadata; torrents: TorrentResult[] }>;
    unmatched: Array<{ sceneTitle: string; torrents: TorrentResult[] }>;
  }> {
    const settings = await this.settingsService.getSettings();
    const threshold = settings.ai.crossEncoderThreshold || 0.7;
    const unknownThreshold = settings.ai.unknownThreshold || 0.4;

    // Load model once at the start for all matches (job-level load)
    await this.logsService.info(
      "torrent",
      `🔄 Loading Cross-Encoder model once for ${groups.length} groups`,
      { groupsCount: groups.length }
    );
    await this.crossEncoderService.initialize();

    try {
      // ... rest of the matching logic here
      return await this.performCrossEncoderMatching(
        groups,
        entity,
        entityType,
        threshold,
        unknownThreshold
      );
    } finally {
      // Unload model after all matches complete (job-level unload)
      await this.logsService.info(
        "torrent",
        `🔄 Unloading Cross-Encoder model after matching ${groups.length} groups`
      );
      this.crossEncoderService.unload();
    }
  }

  /**
   * Perform the actual Cross-Encoder matching logic
   * Called after model is loaded, runs all matches before model is unloaded
   */
  private async performCrossEncoderMatching(
    groups: Array<{ sceneTitle: string; torrents: TorrentResult[] }>,
    entity: any,
    entityType: "performer" | "studio",
    threshold: number,
    unknownThreshold: number
  ): Promise<{
    matched: Array<{ scene: SceneMetadata; torrents: TorrentResult[] }>;
    unmatched: Array<{ sceneTitle: string; torrents: TorrentResult[] }>;
  }> {

    // Get candidate scenes from database
    const candidateScenes = await this.getCandidateScenes(entityType, entity.id);

    const matched: Array<{ scene: SceneMetadata; torrents: TorrentResult[] }> = [];
    const unmatched: Array<{ sceneTitle: string; torrents: TorrentResult[] }> = [];
    const matchedSceneIds = new Set<string>(); // Track matched scenes to prevent duplicates

    // Statistics tracking
    const stats = {
      totalGroups: groups.length,
      candidateScenes: candidateScenes.length,
      matched: 0,
      unmatched: 0,
      unknown: 0, // Below unknown threshold
      uncertain: 0, // Between unknown and match threshold
      totalTorrents: groups.reduce((sum, g) => sum + g.torrents.length, 0),
      matchedTorrents: 0,
      averageMatchScore: 0,
      scores: [] as number[],
    };

    await this.logsService.info(
      "torrent",
      `🔍 Cross-Encoder Matching Started`,
      {
        entityType,
        entityName: entity.name,
        torrentGroups: groups.length,
        candidateScenes: candidateScenes.length,
        totalTorrents: stats.totalTorrents,
        matchThreshold: threshold,
        unknownThreshold,
        method: "cross-encoder",
      }
    );

    let processedCount = 0;
    for (const group of groups) {
      processedCount++;
      try {
        // Filter out already-matched scenes to prevent duplicates
        const availableScenes = candidateScenes.filter(
          (s) => !matchedSceneIds.has(s.id)
        );

        if (availableScenes.length === 0) {
          // All candidate scenes already matched
          unmatched.push(group);
          stats.unmatched++;
          await this.logsService.debug(
            "torrent",
            `⏭️ [${processedCount}/${groups.length}] Skipped: "${group.sceneTitle}" (all candidate scenes already matched)`,
            {
              torrentTitle: group.sceneTitle,
              torrentsInGroup: group.torrents.length,
              status: "skipped",
            }
          );
          continue;
        }

        // Clean performer/studio names from title - but only at the START
        // This preserves the scene content while removing the search entity prefix
        // Example: "Jane Doe - Hot Scene 2024" -> "Hot Scene 2024"
        // But: "Scene with Jane Doe" stays as "Scene with Jane Doe" (name in middle/end)
        let cleanedTitle = group.sceneTitle;

        const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        if (entityType === "performer") {
          const allNames = [entity.name, ...(entity.aliases || [])];

          // Only remove names at the START of the title (with optional separator)
          for (const name of allNames) {
            // Match: "Name - ", "Name: ", "Name, ", "Name " at start
            const startPattern = new RegExp(`^${escapeRegex(name)}\\s*[-–—:,]?\\s*`, "i");
            if (startPattern.test(cleanedTitle)) {
              cleanedTitle = cleanedTitle.replace(startPattern, "");
              break; // Only remove one occurrence at start
            }
          }
        } else if (entityType === "studio" && entity.name) {
          // Same for studio - only remove at start
          const startPattern = new RegExp(`^${escapeRegex(entity.name)}\\s*[-–—:,]?\\s*`, "i");
          cleanedTitle = cleanedTitle.replace(startPattern, "");
        }

        // Clean up any remaining leading/trailing punctuation and spaces
        cleanedTitle = cleanedTitle.replace(/^[-–—:,\s]+|[-–—:,\s]+$/g, "").trim();

        // If title became empty or too short, use original
        if (cleanedTitle.length < 5) {
          cleanedTitle = group.sceneTitle;
        }

        // Construct query with multi-signal information
        const query = {
          performer: entityType === "performer" ? entity.name : undefined,
          studio: entityType === "studio" ? entity.name : (entity.studioName || undefined),
          title: cleanedTitle,
        };

        // Find best match using Cross-Encoder (model already loaded at job level)
        const match = await this.crossEncoderService.findBestMatch(
          query,
          availableScenes.map((s) => ({
            id: s.id,
            title: s.title,
            date: s.date || undefined,
            studio: s.studioName,  // Use studio NAME, not ID
            performers: s.performerNames,  // Include performer names for better matching
          })),
          threshold
        );

        if (match) {
          const scene = candidateScenes.find((s) => s.id === match.candidate.id)!;

          // Mark this scene as matched to prevent duplicates
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
          stats.matched++;
          stats.matchedTorrents += group.torrents.length;
          stats.scores.push(match.score);

          await this.logsService.info(
            "torrent",
            `✅ [${processedCount}/${groups.length}] Match: "${group.sceneTitle}" → "${scene.title}"`,
            {
              torrentTitle: group.sceneTitle,
              sceneTitle: scene.title,
              sceneId: scene.id,
              score: match.score,
              threshold,
              torrentsInGroup: group.torrents.length,
              confidence: `${(match.score * 100).toFixed(1)}%`,
            },
            { sceneId: scene.id }
          );
        } else {
          // No match found - check if it's unknown or uncertain
          // Get the best score even if below threshold
          const allScores = await Promise.all(
            candidateScenes.slice(0, 5).map(async (s) => {
              const score = await this.crossEncoderService.scorePair(query, {
                id: s.id,
                title: s.title,
                date: s.date || undefined,
                studio: s.studioId,
              });
              return { score, scene: s };
            })
          );

          allScores.sort((a, b) => b.score - a.score);
          const bestScore = allScores[0]?.score || 0;

          unmatched.push(group);
          stats.unmatched++;

          if (bestScore < unknownThreshold) {
            stats.unknown++;
            await this.logsService.info(
              "torrent",
              `🆕 [${processedCount}/${groups.length}] Unknown: "${group.sceneTitle}" (best: ${(bestScore * 100).toFixed(1)}%)`,
              {
                torrentTitle: group.sceneTitle,
                bestScore,
                bestMatch: allScores[0]?.scene.title,
                threshold,
                unknownThreshold,
                torrentsInGroup: group.torrents.length,
                status: "unknown",
              }
            );
          } else {
            stats.uncertain++;
            await this.logsService.debug(
              "torrent",
              `⚠️ [${processedCount}/${groups.length}] Uncertain: "${group.sceneTitle}" (best: ${(bestScore * 100).toFixed(1)}%)`,
              {
                torrentTitle: group.sceneTitle,
                bestScore,
                bestMatch: allScores[0]?.scene.title,
                threshold,
                torrentsInGroup: group.torrents.length,
                status: "uncertain",
                topMatches: allScores.slice(0, 3).map(a => ({
                  title: a.scene.title,
                  score: a.score,
                })),
              }
            );
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        logger.error("Cross-Encoder matching failed for group:", {
          errorMessage,
          errorStack,
          groupTitle: group.sceneTitle,
        });
        await this.logsService.error(
          "torrent",
          `Cross-Encoder failed for "${group.sceneTitle}": ${errorMessage}`,
          { error: errorStack || errorMessage }
        );
        // On error, treat as unmatched
        unmatched.push(group);
        stats.unmatched++;
      }
    }

    // Calculate average match score
    if (stats.scores.length > 0) {
      stats.averageMatchScore = stats.scores.reduce((sum, s) => sum + s, 0) / stats.scores.length;
    }

    await this.logsService.info(
      "torrent",
      `📊 Cross-Encoder Matching Complete`,
      {
        summary: {
          totalGroups: stats.totalGroups,
          matched: stats.matched,
          unmatched: stats.unmatched,
          unknown: stats.unknown,
          uncertain: stats.uncertain,
        },
        torrents: {
          total: stats.totalTorrents,
          matched: stats.matchedTorrents,
          unmatchedTorrents: stats.totalTorrents - stats.matchedTorrents,
        },
        performance: {
          matchRate: `${((stats.matched / stats.totalGroups) * 100).toFixed(1)}%`,
          averageMatchScore: stats.averageMatchScore.toFixed(3),
          candidatesChecked: stats.candidateScenes,
        },
        thresholds: {
          match: threshold,
          unknown: unknownThreshold,
        },
      }
    );

    return { matched, unmatched };
  }

  /**
   * Handle discovery of unknown scenes
   * Logs discovered groups temporarily - does NOT persist to database
   * Groups are re-created on each search run to avoid stale data
   */
  private async handleDiscovery(
    unmatchedGroups: Array<{ sceneTitle: string; torrents: TorrentResult[] }>,
    entity: any,
    entityType: "performer" | "studio",
    searchPhase: "performer" | "studio" | "targeted"
  ): Promise<void> {
    // Default minimum indexers (previously from settings.general.minIndexersForMetadataLess)
    const minIndexers = 3;

    await this.logsService.info(
      "torrent",
      `🔎 Discovery Phase Started`,
      {
        unmatchedGroups: unmatchedGroups.length,
        minIndexersRequired: minIndexers,
        searchPhase,
        entityType,
        entityName: entity.name,
      }
    );

    let discoveredCount = 0;
    let skippedCount = 0;
    const discoveryDetails: Array<{
      title: string;
      torrents: number;
      indexers: number;
    }> = [];

    for (const group of unmatchedGroups) {
      const uniqueIndexers = new Set(group.torrents.map((t) => t.indexerId));

      // Only log discovery if minimum indexer requirement is met
      if (uniqueIndexers.size >= minIndexers) {
        discoveryDetails.push({
          title: group.sceneTitle,
          torrents: group.torrents.length,
          indexers: uniqueIndexers.size,
        });

        await this.logsService.info(
          "torrent",
          `🆕 Discovered: "${group.sceneTitle}"`,
          {
            groupTitle: group.sceneTitle,
            torrentCount: group.torrents.length,
            indexerCount: uniqueIndexers.size,
            searchPhase,
            entityType,
            entityId: entity.id,
            entityName: entity.name,
          },
          entityType === "performer"
            ? { performerId: entity.id }
            : { studioId: entity.id }
        );

        discoveredCount++;
      } else {
        skippedCount++;
        await this.logsService.debug(
          "torrent",
          `⏭️ Skipped: "${group.sceneTitle}" (${uniqueIndexers.size}/${minIndexers} indexers)`,
          {
            groupTitle: group.sceneTitle,
            indexerCount: uniqueIndexers.size,
            minRequired: minIndexers,
            reason: "below minimum indexer threshold",
          }
        );
      }
    }

    await this.logsService.info(
      "torrent",
      `📋 Discovery Phase Complete (temporary, not persisted)`,
      {
        summary: {
          totalUnmatched: unmatchedGroups.length,
          discovered: discoveredCount,
          skipped: skippedCount,
          discoveryRate: unmatchedGroups.length > 0
            ? `${((discoveredCount / unmatchedGroups.length) * 100).toFixed(1)}%`
            : "0%",
        },
        discovered: discoveryDetails,
        minIndexers,
        searchPhase,
        entityType,
        entityName: entity.name,
      }
    );
  }

  /**
   * Get candidate scenes for matching based on entity type
   * Filters out scenes with disabled scene-level subscriptions
   */
  private async getCandidateScenes(
    entityType: "performer" | "studio",
    entityId: string
  ): Promise<SceneMetadata[]> {
    if (entityType === "performer") {
      // Get scenes for this performer
      const performerScenes = await this.db.query.performersScenes.findMany({
        where: eq(performersScenes.performerId, entityId),
        with: {
          scene: true,
        },
        limit: 500, // Limit to prevent overwhelming the AI
      });

      // Get all active scene-level subscriptions (whitelist approach)
      const allowedSceneIds = new Set<string>();
      const sceneSubscriptions = await this.db.query.subscriptions.findMany({
        where: and(
          eq(subscriptions.entityType, "scene"),
          eq(subscriptions.isSubscribed, true)
        ),
      });

      for (const sub of sceneSubscriptions) {
        allowedSceneIds.add(sub.entityId);
      }

      // Only include scenes that have an active scene subscription
      const filteredScenes = performerScenes.filter(
        (ps) => allowedSceneIds.has(ps.scene.id)
      );

      await this.logsService.debug(
        "torrent",
        `Candidate scenes for performer: ${performerScenes.length} total, ${filteredScenes.length} with active scene subscriptions (${performerScenes.length - filteredScenes.length} excluded)`,
        {
          totalScenes: performerScenes.length,
          withSubscription: filteredScenes.length,
          withoutSubscription: performerScenes.length - filteredScenes.length,
          performerId: entityId,
        }
      );

      // Fetch performer name for cross-encoder
      const performer = await this.db.query.performers.findFirst({
        where: eq(performers.id, entityId),
      });

      return filteredScenes.map((ps) => ({
        id: ps.scene.id,
        title: ps.scene.title,
        date: ps.scene.date,
        performerIds: [entityId],
        studioId: ps.scene.siteId || undefined,
        performerNames: performer ? [performer.name] : undefined,
        studioName: undefined, // Could fetch studio name if needed
      }));
    } else {
      // Get scenes for this studio
      const studioScenes = await this.db.query.scenes.findMany({
        where: eq(scenes.siteId, entityId),
        limit: 500,
      });

      // Get all active scene-level subscriptions (whitelist approach)
      const allowedSceneIds = new Set<string>();
      const sceneSubscriptions = await this.db.query.subscriptions.findMany({
        where: and(
          eq(subscriptions.entityType, "scene"),
          eq(subscriptions.isSubscribed, true)
        ),
      });

      for (const sub of sceneSubscriptions) {
        allowedSceneIds.add(sub.entityId);
      }

      // Only include scenes that have an active scene subscription
      const filteredScenes = studioScenes.filter(
        (s) => allowedSceneIds.has(s.id)
      );

      await this.logsService.debug(
        "torrent",
        `Candidate scenes for studio: ${studioScenes.length} total, ${filteredScenes.length} with active scene subscriptions (${studioScenes.length - filteredScenes.length} excluded)`,
        {
          totalScenes: studioScenes.length,
          withSubscription: filteredScenes.length,
          withoutSubscription: studioScenes.length - filteredScenes.length,
          studioId: entityId,
        }
      );

      // Fetch studio name for cross-encoder
      const studio = await this.db.query.sites.findFirst({
        where: eq(sites.id, entityId),
      });

      return filteredScenes.map((s) => ({
        id: s.id,
        title: s.title,
        date: s.date,
        performerIds: [],
        studioId: s.siteId || undefined,
        performerNames: undefined,
        studioName: studio?.name,
      }));
    }
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
export function createTorrentSearchService(
  db: Database,
  logsService: LogsService,
  settingsService: SettingsService,
  aiMatchingService: AIMatchingService,
  crossEncoderService: CrossEncoderService,
  aiMatchScoresRepository: AIMatchScoresRepository
): TorrentSearchService {
  return new TorrentSearchService({
    db,
    logsService,
    settingsService,
    aiMatchingService,
    crossEncoderService,
    aiMatchScoresRepository,
  });
}
