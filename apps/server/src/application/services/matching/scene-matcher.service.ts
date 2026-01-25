/**
 * Scene matching service with scoring system
 * Finds the best match for a torrent title among candidate scenes
 */

import type { AIMatchingService } from "../ai-matching/ai-matching.service.js";
import type { LogsService } from "../logs.service.js";
import {
  type MatchResult,
  type MatchSettings,
  type SceneMetadata,
  type MatchCandidate,
} from "./match-types.js";
import { TitleNormalizer } from "./title-normalizer.js";
import { DateExtractor } from "./date-extractor.js";

export class SceneMatcher {
  private aiMatchingService: AIMatchingService;
  private logsService: LogsService;

  constructor({
    aiMatchingService,
    logsService,
  }: {
    aiMatchingService: AIMatchingService;
    logsService: LogsService;
  }) {
    this.aiMatchingService = aiMatchingService;
    this.logsService = logsService;
  }
  // ... (rest of class)


  /**
   * Find the best matching scene for a torrent title
   * Returns the highest-scored match, or null if no match found
   */
  async findBestMatch(
    torrentTitle: string,
    candidateScenes: SceneMetadata[],
    settings: MatchSettings
  ): Promise<MatchResult | null> {
    if (candidateScenes.length === 0) {
      return null;
    }

    // Pre-process the torrent title
    const normalizedTorrentTitle = TitleNormalizer.removeMetadata(torrentTitle);
    const torrentDate = DateExtractor.extractDate(torrentTitle);

    let bestMatch: MatchResult | null = null;

    // Try to match each candidate scene
    for (const scene of candidateScenes) {
      const normalizedSceneTitle = TitleNormalizer.normalize(scene.title);

      // Try matching methods in priority order
      let candidate: MatchCandidate | null = null;

      // 1. Exact match (highest priority)
      if (this.matchExact(normalizedTorrentTitle, normalizedSceneTitle)) {
        candidate = {
          scene,
          score: 100,
          method: "exact",
          confidence: 1.0,
        };
      }

      // 2. Truncated match
      if (!candidate) {
        const truncatedMatch = this.matchTruncated(
          normalizedTorrentTitle,
          normalizedSceneTitle,
          settings.groupingThreshold
        );
        if (truncatedMatch.match) {
          candidate = {
            scene,
            score: truncatedMatch.score,
            method: "truncated",
            confidence: truncatedMatch.confidence,
          };
        }
      }

      // 3. Partial match
      if (!candidate) {
        const partialMatch = this.matchPartial(normalizedTorrentTitle, normalizedSceneTitle);
        if (partialMatch.match) {
          candidate = {
            scene,
            score: partialMatch.score,
            method: "partial",
            confidence: partialMatch.confidence,
          };
        }
      }

      // 4. AI match (if enabled)
      if (!candidate && settings.aiEnabled) {
        try {
          const aiScore = await this.matchAI(
            normalizedTorrentTitle,
            normalizedSceneTitle,
            settings.groupingThreshold // Use groupingThreshold as user requested
          );
          if (aiScore !== null) {
            candidate = {
              scene,
              score: aiScore * 100,
              method: "ai",
              confidence: aiScore,
            };
          }
        } catch (error) {
          // AI matching failed, continue to Levenshtein
          await this.logsService.warning(
            "torrent",
            "AI matching failed, falling back to Levenshtein",
            { error: error instanceof Error ? error.message : String(error) }
          );
        }
      }

      // 5. Levenshtein match (fallback)
      if (!candidate) {
        const levScore = this.matchLevenshtein(
          normalizedTorrentTitle,
          normalizedSceneTitle,
          settings.levenshteinThreshold
        );
        if (levScore !== null) {
          candidate = {
            scene,
            score: levScore * 100,
            method: "levenshtein",
            confidence: levScore,
          };
        }
      }

      // Apply date bonus if we have a match
      if (candidate) {
        const dateBonus = DateExtractor.getDateBonus(torrentDate, scene.date);
        candidate.score += dateBonus;

        // Update best match if this candidate is better
        if (!bestMatch || candidate.score > bestMatch.score) {
          bestMatch = candidate;
        }

        // Early termination for perfect match
        if (candidate.score >= 100) {
          break;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Exact match check
   * Returns true if normalized titles are identical
   */
  private matchExact(title1: string, title2: string): boolean {
    return title1 === title2;
  }

  /**
   * Truncated match check
   * One title is a prefix of the other
   */
  private matchTruncated(
    title1: string,
    title2: string,
    threshold: number
  ): { match: boolean; score: number; confidence: number } {
    const isPrefix = title1.startsWith(title2) || title2.startsWith(title1);

    if (!isPrefix) {
      return { match: false, score: 0, confidence: 0 };
    }

    // Calculate length ratio
    const ratio = TitleNormalizer.lengthRatio(title1, title2);

    // Match if ratio is above threshold
    if (ratio >= threshold) {
      // Score: 90-95 based on how close the ratio is to 1.0
      const score = 90 + ratio * 5;
      return { match: true, score, confidence: ratio };
    }

    return { match: false, score: 0, confidence: 0 };
  }

  /**
   * Partial match check
   * Shorter string (>20 chars) substantially contained in longer
   */
  private matchPartial(
    title1: string,
    title2: string
  ): { match: boolean; score: number; confidence: number } {
    const shorter = title1.length < title2.length ? title1 : title2;
    const longer = title1.length < title2.length ? title2 : title1;

    const isPartial = TitleNormalizer.isPartialMatch(shorter, longer, 20);

    if (isPartial) {
      const ratio = TitleNormalizer.lengthRatio(title1, title2);
      // Score: 80-85 based on length ratio
      const score = 80 + ratio * 5;
      return { match: true, score, confidence: ratio };
    }

    return { match: false, score: 0, confidence: 0 };
  }

  /**
   * AI-based cosine similarity match
   * Returns similarity score (0-1) or null if below threshold
   */
  private async matchAI(
    title1: string,
    title2: string,
    threshold: number
  ): Promise<number | null> {
    try {
      const similarity = await this.aiMatchingService.calculateSimilarity(title1, title2);

      if (similarity >= threshold) {
        return similarity;
      }

      return null;
    } catch (error) {
      // Re-throw to be handled by caller
      throw error;
    }
  }

  /**
   * Levenshtein distance match
   * Returns similarity score (0-1) or null if below threshold
   */
  private matchLevenshtein(
    title1: string,
    title2: string,
    threshold: number
  ): number | null {
    const similarity = this.calculateSimilarity(title1, title2);

    if (similarity >= threshold) {
      return similarity;
    }

    return null;
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   * Returns a value between 0 and 1 (1 = identical)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

/**
 * Factory function to create SceneMatcher instance
 */
export function createSceneMatcher(
  aiMatchingService: AIMatchingService,
  logsService: LogsService
): SceneMatcher {
  return new SceneMatcher({ aiMatchingService, logsService });
}
