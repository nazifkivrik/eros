import type { Database } from "@repo/database";
import { aiMatchScores } from "@repo/database/schema";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";

/**
 * AI Match Scores Repository
 * Handles CRUD operations for AI matching scores tracking
 */
export class AIMatchScoresRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Create a new AI match score record
   * Used to track all AI matching decisions for debugging and analysis
   */
  async create(data: {
    sceneId: string;
    torrentTitle: string;
    score: number;
    method: "cross-encoder" | "bi-encoder" | "levenshtein";
    model?: string;
    threshold: number;
    matched: boolean;
  }) {
    const id = nanoid();

    await this.db.insert(aiMatchScores).values({
      id,
      sceneId: data.sceneId,
      torrentTitle: data.torrentTitle,
      score: data.score,
      method: data.method,
      model: data.model || null,
      threshold: data.threshold,
      matched: data.matched,
    });

    return id;
  }

  /**
   * Get all AI scores for a specific scene
   * Ordered by most recent first
   */
  async getSceneScores(sceneId: string) {
    return this.db.query.aiMatchScores.findMany({
      where: eq(aiMatchScores.sceneId, sceneId),
      orderBy: [desc(aiMatchScores.createdAt)],
    });
  }

  /**
   * Get AI scores by method
   * Useful for comparing different AI approaches
   */
  async getScoresByMethod(method: "cross-encoder" | "bi-encoder" | "levenshtein") {
    return this.db.query.aiMatchScores.findMany({
      where: eq(aiMatchScores.method, method),
      orderBy: [desc(aiMatchScores.createdAt)],
      limit: 100,
    });
  }

  /**
   * Get statistics about AI matching
   * Returns counts and averages for different methods
   */
  async getMatchingStats() {
    const allScores = await this.db.query.aiMatchScores.findMany();

    const stats = {
      total: allScores.length,
      byMethod: {
        crossEncoder: {
          count: 0,
          matched: 0,
          avgScore: 0,
        },
        biEncoder: {
          count: 0,
          matched: 0,
          avgScore: 0,
        },
        levenshtein: {
          count: 0,
          matched: 0,
          avgScore: 0,
        },
      },
    };

    let crossEncoderSum = 0;
    let biEncoderSum = 0;
    let levenshteinSum = 0;

    for (const score of allScores) {
      const method = score.method;
      const isMatched = score.matched;

      if (method === "cross-encoder") {
        stats.byMethod.crossEncoder.count++;
        if (isMatched) stats.byMethod.crossEncoder.matched++;
        crossEncoderSum += score.score;
      } else if (method === "bi-encoder") {
        stats.byMethod.biEncoder.count++;
        if (isMatched) stats.byMethod.biEncoder.matched++;
        biEncoderSum += score.score;
      } else if (method === "levenshtein") {
        stats.byMethod.levenshtein.count++;
        if (isMatched) stats.byMethod.levenshtein.matched++;
        levenshteinSum += score.score;
      }
    }

    // Calculate averages
    if (stats.byMethod.crossEncoder.count > 0) {
      stats.byMethod.crossEncoder.avgScore =
        crossEncoderSum / stats.byMethod.crossEncoder.count;
    }
    if (stats.byMethod.biEncoder.count > 0) {
      stats.byMethod.biEncoder.avgScore =
        biEncoderSum / stats.byMethod.biEncoder.count;
    }
    if (stats.byMethod.levenshtein.count > 0) {
      stats.byMethod.levenshtein.avgScore =
        levenshteinSum / stats.byMethod.levenshtein.count;
    }

    return stats;
  }

  /**
   * Delete all scores for a scene
   * Useful when re-processing a scene
   */
  async deleteSceneScores(sceneId: string) {
    await this.db
      .delete(aiMatchScores)
      .where(eq(aiMatchScores.sceneId, sceneId));
  }

  /**
   * Get recent scores (for monitoring)
   */
  async getRecentScores(limit = 50) {
    return this.db.query.aiMatchScores.findMany({
      orderBy: [desc(aiMatchScores.createdAt)],
      limit,
    });
  }
}
