/**
 * Torrent Quality Match Service
 * Handles match scoring for torrent title comparison
 *
 * Responsibilities:
 * - AI-based semantic matching
 * - Levenshtein distance matching
 * - Text normalization for comparison
 */

import type { AIMatchingService } from "../../../ai-matching/ai-matching.service.js";
import type { LogsService } from "../../logs.service.js";
import { logger } from "../../../utils/logger.js";

/**
 * Torrent Quality Match Service
 */
export class TorrentQualityMatchService {
  private aiMatchingService: AIMatchingService | null;
  private logsService: LogsService;

  constructor(deps: {
    aiMatchingService?: AIMatchingService | null;
    logsService: LogsService;
  }) {
    this.aiMatchingService = deps.aiMatchingService || null;
    this.logsService = deps.logsService;
  }

  /**
   * Calculate match score between torrent title and expected title
   * Uses AI matching if available, falls back to Levenshtein distance
   */
  async calculateMatchScore(
    torrentTitle: string,
    expectedTitle: string,
    useAI = true
  ): Promise<number> {
    // Use AI matching if available and requested
    if (useAI && this.aiMatchingService) {
      try {
        return await this.calculateMatchScoreAI(torrentTitle, expectedTitle);
      } catch (error) {
        // Fall back to Levenshtein if AI fails
        await this.logsService.error(
          "torrent",
          `AI matching failed, falling back to Levenshtein: ${error instanceof Error ? error.message : "Unknown error"}`,
          { error: error instanceof Error ? error.stack : String(error) }
        );
      }
    }

    // Levenshtein-based matching
    return this.calculateMatchScoreLevenshtein(torrentTitle, expectedTitle);
  }

  /**
   * Calculate match score using AI semantic similarity
   */
  private async calculateMatchScoreAI(
    torrentTitle: string,
    expectedTitle: string
  ): Promise<number> {
    if (!this.aiMatchingService) {
      throw new Error("AI service not available");
    }

    // Preprocess both titles
    const processedTorrent = this.aiMatchingService.preprocessText(torrentTitle);
    const processedExpected = this.aiMatchingService.preprocessText(expectedTitle);

    // Calculate semantic similarity (returns 0-1)
    const similarity = await this.aiMatchingService.calculateSimilarity(
      processedTorrent,
      processedExpected
    );

    // Convert to 0-100 scale
    return Math.round(similarity * 100);
  }

  /**
   * Calculate match score using Levenshtein distance
   */
  private calculateMatchScoreLevenshtein(
    torrentTitle: string,
    expectedTitle: string
  ): number {
    const normalizedTorrent = this.normalizeTitle(torrentTitle);
    const normalizedExpected = this.normalizeTitle(expectedTitle);

    const distance = this.levenshteinDistance(
      normalizedTorrent,
      normalizedExpected
    );
    const maxLength = Math.max(
      normalizedTorrent.length,
      normalizedExpected.length
    );

    // Convert distance to similarity score (0-100)
    const similarity = ((maxLength - distance) / maxLength) * 100;

    return Math.max(0, Math.min(100, Math.round(similarity)));
  }

  /**
   * Normalize title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // Remove special characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
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
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Check if AI matching is available
   */
  isAIMatchingAvailable(): boolean {
    return this.aiMatchingService !== null;
  }
}
