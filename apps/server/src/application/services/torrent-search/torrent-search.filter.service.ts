/**
 * Torrent Search Filter Service
 * Handles filtering, deduplication, and grouping of torrent results
 *
 * Responsibilities:
 * - Deduplication by infoHash
 * - Hard filtering (name integrity)
 * - Scene title extraction
 * - Grouping by scene
 */

import type { LogsService } from "../../logs.service.js";
import type { TorrentResult, SceneGroup } from "../torrent-search/index.js";

/**
 * Torrent Search Filter Service
 */
export class TorrentSearchFilterService {
  private logsService: LogsService;

  constructor(deps: { logsService: LogsService }) {
    this.logsService = deps.logsService;
  }

  /**
   * Deduplicate torrents by infoHash
   * Same torrent from multiple indexers is merged into one entry with indexerCount
   * Higher indexerCount = more popular/reliable torrent
   */
  deduplicateByInfoHash(results: TorrentResult[]): TorrentResult[] {
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
   * Apply hard filters (name integrity)
   * Eliminates false matches like "jade kush" when searching "jade harper"
   */
  async applyHardFilters(
    results: TorrentResult[],
    entityType: "performer" | "studio",
    entity: { name: string; aliases?: string[] }
  ): Promise<TorrentResult[]> {
    // Build allowed names list
    const allowedNames: string[] = [entity.name.toLowerCase()];
    if (entity.aliases && entity.aliases.length > 0) {
      allowedNames.push(
        ...entity.aliases.map((a: string) => a.toLowerCase())
      );
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
   * Group results by scene with regex-based grouping
   */
  groupByScene(results: TorrentResult[]): SceneGroup[] {
    const groupingThreshold = 0.7;
    const phase1Groups = new Map<string, TorrentResult[]>();

    for (const result of results) {
      // Extract scene title by removing quality, source, and common metadata
      const sceneTitle = this.extractSceneTitle(result.title);

      // Skip if title is too short or generic
      if (sceneTitle.length < 15) {
        if (!phase1Groups.has(sceneTitle)) {
          phase1Groups.set(sceneTitle, []);
        }
        phase1Groups.get(sceneTitle)!.push(result);
        continue;
      }

      // Check if this title matches any existing group (strict rules only)
      let matchedGroupKey: string | null = null;

      for (const existingKey of phase1Groups.keys()) {
        if (existingKey.length < 15) continue;

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
            if (longer === existingKey) {
              matchedGroupKey = existingKey;
            } else {
              const existingTorrents = phase1Groups.get(existingKey)!;
              phase1Groups.delete(existingKey);
              matchedGroupKey = longer;
              phase1Groups.set(matchedGroupKey, existingTorrents);
            }
            break;
          }
        }
      }

      const groupKey = matchedGroupKey || sceneTitle;
      if (!phase1Groups.has(groupKey)) {
        phase1Groups.set(groupKey, []);
      }
      phase1Groups.get(groupKey)!.push(result);
    }

    // Convert Phase 1 groups to array format
    const groupedResults = Array.from(phase1Groups.entries()).map(
      ([sceneTitle, torrents]) => ({
        sceneTitle,
        torrents,
      })
    );

    return groupedResults;
  }

  /**
   * Extract scene title from torrent title by removing metadata
   */
  extractSceneTitle(title: string): string {
    let cleaned = title;

    // Remove everything after common spam indicators
    cleaned = cleaned.replace(
      /\s+(want more|watch and download|get of accounts|backup\/latest|to watch video|#hd|#in).*/gi,
      ""
    );

    // Remove telegram links
    cleaned = cleaned.replace(/t\.me\/[^\s]+/gi, "");

    // Remove URLs
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
      /\b(onlyfans|manyvids|fansly|patreon|fancentro|pornhub|xvideos|chaturbate|cam4|myfreecams|mfc|streamate|mrluckyraw|tagteampov|baddiesonlypov)[-.\s]*/gi,
      ""
    );

    // Remove spam keywords
    cleaned = cleaned.replace(
      /\b(new|full|xxx|nsfw|leaked|exclusive|premium|vip|hot|sexy|latest|hd|rq)\b/gi,
      ""
    );

    // Remove date patterns
    cleaned = cleaned.replace(/\b\d{2}\s+\d{2}\s+\d{2}\b/g, "");
    cleaned = cleaned.replace(/\b\d{4}\s+\d{2}\s+\d{2}\b/g, "");
    cleaned = cleaned.replace(/\b(19|20)\d{2}[-_.]\d{2}[-_.]\d{2}\b/g, "");
    cleaned = cleaned.replace(/\b(19|20)\d{2}\b/g, "");

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

    // Remove scene numbering patterns
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
    cleaned = cleaned.replace(/^[-_.",]+|[-_.",]+$/g, "");

    return cleaned || title; // Fallback to original if cleaning resulted in empty string
  }
}
