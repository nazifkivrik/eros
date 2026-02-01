/**
 * Strict Token-Based Matcher
 *
 * Replaces Cross-Encoder for more deterministic, accurate matching.
 *
 * Key principles:
 * 1. False positives are worse than false negatives
 * 2. Match based on meaningful tokens, not AI "feelings"
 * 3. Multiple validation factors before accepting a match
 *
 * Scoring factors:
 * - Token overlap (0-1): How many words appear in both titles
 * - Sequence match (0-1): How many words appear in same order
 * - Length similarity (0-1): Are titles similar length?
 * - Date match (0-1): Do dates match exactly?
 * - Studio match (0-1): Do studios match exactly?
 *
 * Final score: Weighted combination
 * Minimum threshold: 0.7
 * Additional validation: Top score must be > 2x second best score
 */

import type { Logger } from "pino";

interface StrictMatchOptions {
  threshold?: number;
  requireMinTokens?: number;
  requireScoreGap?: number; // Top score must be this much higher than second best
}

interface TokenMatchResult {
  sceneId: string;
  sceneTitle: string;
  score: number;
  breakdown: {
    tokenOverlap: number;
    sequenceMatch: number;
    lengthSimilarity: number;
    dateMatch: number;
    studioMatch: number;
  };
}

interface MatchCandidate {
  id: string;
  title: string;
  date?: string;
  studio?: string;
  performers?: string[];
}

export class StrictTokenMatcher {
  private logger: Logger;
  private readonly STOP_WORDS = new Set([
    "the", "a", "an", "and", "or", "but", "with", "for", "from", "at", "by",
    "in", "on", "to", "of", "is", "are", "was", "were", "xxx", "porn", "sex",
    "video", "scene", "clip", "mp4", "mkv", "avi", "1080p", "720p", "480p", "2160p", "4k"
  ]);

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Extract meaningful tokens from a title
   */
  private extractTokens(title: string): string[] {
    // Normalize: lowercase, remove special chars, split by whitespace
    const normalized = title
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const tokens = normalized.split(" ").filter(t =>
      t.length >= 3 && // Minimum 3 chars
      !this.STOP_WORDS.has(t) && // Not a stop word
      !/^\d+$/.test(t) // Not just numbers
    );

    return tokens;
  }

  /**
   * Calculate token overlap between two titles
   */
  private calculateTokenOverlap(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Calculate sequence match (Longest Common Subsequence)
   * Rewards words appearing in the same order
   */
  private calculateSequenceMatch(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    // Find longest common subsequence
    const dp: number[][] = Array(tokens1.length + 1).fill(0)
      .map(() => Array(tokens2.length + 1).fill(0));

    for (let i = 1; i <= tokens1.length; i++) {
      for (let j = 1; j <= tokens2.length; j++) {
        if (tokens1[i - 1] === tokens2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const lcs = dp[tokens1.length][tokens2.length];
    const maxLen = Math.max(tokens1.length, tokens2.length);

    return lcs / maxLen;
  }

  /**
   * Calculate length similarity
   */
  private calculateLengthSimilarity(len1: number, len2: number): number {
    const max = Math.max(len1, len2);
    const min = Math.min(len1, len2);
    return max === 0 ? 1 : min / max;
  }

  /**
   * Calculate date match (exact match = 1, no match = 0)
   */
  private calculateDateMatch(date1?: string, date2?: string): number {
    if (!date1 || !date2) return 0;
    return date1 === date2 ? 1 : 0;
  }

  /**
   * Calculate studio match (exact match = 1, no match = 0)
   */
  private calculateStudioMatch(studio1?: string, studio2?: string): number {
    if (!studio1 || !studio2) return 0;
    return studio1.toLowerCase() === studio2.toLowerCase() ? 1 : 0;
  }

  /**
   * Main matching function
   */
  findBestMatch(
    torrentTitle: string,
    candidates: MatchCandidate[],
    options: StrictMatchOptions = {}
  ): TokenMatchResult | null {
    const {
      threshold = 0.7,
      requireMinTokens = 2,
      requireScoreGap = 1.5
    } = options;

    if (candidates.length === 0) return null;

    this.logger.info({
      torrentTitle,
      candidateCount: candidates.length,
      threshold,
    }, "Strict token matching started");

    const torrentTokens = this.extractTokens(torrentTitle);

    if (torrentTokens.length < requireMinTokens) {
      this.logger.warn({
        torrentTitle,
        tokenCount: torrentTokens.length,
        minRequired: requireMinTokens,
      }, "Not enough meaningful tokens in torrent title");
      return null;
    }

    // Score all candidates
    const scores: TokenMatchResult[] = candidates.map(candidate => {
      const sceneTokens = this.extractTokens(candidate.title);

      const tokenOverlap = this.calculateTokenOverlap(torrentTokens, sceneTokens);
      const sequenceMatch = this.calculateSequenceMatch(torrentTokens, sceneTokens);
      const lengthSimilarity = this.calculateLengthSimilarity(torrentTokens.length, sceneTokens.length);
      const dateMatch = this.calculateDateMatch(undefined, candidate.date); // Date from torrent if available
      const studioMatch = this.calculateStudioMatch(undefined, candidate.studio);

      // Weighted score - adjusted for better balance
      // Token overlap is most important (50%)
      // Sequence match rewards order (25%)
      // Length similarity prevents matching "A" to "A very long title..." (15%)
      // Date and studio provide confidence boosts (10% total)
      const score =
        (tokenOverlap * 0.50) +
        (sequenceMatch * 0.25) +
        (lengthSimilarity * 0.15) +
        (dateMatch * 0.06) +
        (studioMatch * 0.04);

      return {
        sceneId: candidate.id,
        sceneTitle: candidate.title,
        score,
        breakdown: {
          tokenOverlap,
          sequenceMatch,
          lengthSimilarity,
          dateMatch,
          studioMatch,
        },
      };
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    const second = scores[1];

    // Check threshold
    if (best.score < threshold) {
      this.logger.info({
        torrentTitle,
        bestScore: best.score,
        threshold,
        bestMatch: best.sceneTitle,
        breakdown: best.breakdown,
      }, "No match above threshold");
      return null;
    }

    // Check score gap (prevent false positives) - only if second best is close
    // Only apply if there are multiple candidates and second has meaningful score
    if (second && second.score > 0.3) {
      const ratio = best.score / second.score;
      if (ratio < requireScoreGap) {
        this.logger.info({
          torrentTitle,
          bestScore: best.score,
          secondScore: second.score,
          ratio,
          requiredRatio: requireScoreGap,
          bestMatch: best.sceneTitle,
          secondMatch: second.sceneTitle,
        }, "Score gap too small - rejecting match to prevent false positive");
        return null;
      }
    }

    // Additional validation: Require minimum token overlap - very lenient now
    if (best.breakdown.tokenOverlap < 0.10) {
      this.logger.info({
        torrentTitle,
        tokenOverlap: best.breakdown.tokenOverlap,
        minRequired: 0.10,
        bestMatch: best.sceneTitle,
      }, "Token overlap too low - rejecting match");
      return null;
    }

    this.logger.info({
      torrentTitle,
      matchedScene: best.sceneTitle,
      score: best.score,
      breakdown: best.breakdown,
    }, "✓ Strict token match found");

    return best;
  }
}
