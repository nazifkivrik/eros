import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import { logger } from "../utils/logger.js";

/**
 * AI Matching Service
 * Uses transformer models for semantic similarity matching
 */
export class AIMatchingService {
  private model: FeatureExtractionPipeline | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize the AI model
   * Uses all-MiniLM-L6-v2 for fast sentence embeddings
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        logger.info("Loading AI model for semantic matching...");

        // Load feature extraction pipeline with sentence transformer model
        this.model = await pipeline(
          "feature-extraction",
          "Xenova/all-MiniLM-L6-v2"
        );

        this.isInitialized = true;
        logger.info("AI model loaded successfully");
      } catch (error) {
        logger.error("Failed to load AI model:", error);
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Generate embedding for a text string
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.model) {
      throw new Error("AI model not initialized");
    }

    try {
      // Generate embedding
      const result = await this.model(text, {
        pooling: "mean",
        normalize: true,
      });

      // Extract the embedding array
      const embedding = Array.from(result.data as Float32Array);

      return embedding;
    } catch (error) {
      logger.error("Failed to generate embedding:", error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateCosineSimilarity(
    embedding1: number[],
    embedding2: number[]
  ): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error("Embeddings must have the same length");
    }

    // Calculate dot product
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Calculate semantic similarity between two text strings
   * Returns a score from 0 to 1 (0 = no similarity, 1 = identical)
   */
  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    const [embedding1, embedding2] = await Promise.all([
      this.generateEmbedding(text1),
      this.generateEmbedding(text2),
    ]);

    return this.calculateCosineSimilarity(embedding1, embedding2);
  }

  /**
   * Find best match from a list of candidates
   */
  async findBestMatch(
    query: string,
    candidates: string[],
    threshold = 0.7
  ): Promise<{ text: string; score: number; index: number } | null> {
    if (candidates.length === 0) {
      return null;
    }

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Generate embeddings for all candidates
    const candidateEmbeddings = await Promise.all(
      candidates.map((candidate) => this.generateEmbedding(candidate))
    );

    // Calculate similarities
    const similarities = candidateEmbeddings.map((candidateEmbedding) =>
      this.calculateCosineSimilarity(queryEmbedding, candidateEmbedding)
    );

    // Find best match
    let bestIndex = 0;
    let bestScore = similarities[0];

    for (let i = 1; i < similarities.length; i++) {
      if (similarities[i] > bestScore) {
        bestScore = similarities[i];
        bestIndex = i;
      }
    }

    // Check if best match meets threshold
    if (bestScore < threshold) {
      return null;
    }

    return {
      text: candidates[bestIndex],
      score: bestScore,
      index: bestIndex,
    };
  }

  /**
   * Batch calculate similarities for multiple queries
   */
  async batchCalculateSimilarity(
    queries: string[],
    candidates: string[]
  ): Promise<number[][]> {
    // Generate embeddings for all queries and candidates
    const [queryEmbeddings, candidateEmbeddings] = await Promise.all([
      Promise.all(queries.map((q) => this.generateEmbedding(q))),
      Promise.all(candidates.map((c) => this.generateEmbedding(c))),
    ]);

    // Calculate similarity matrix
    const similarityMatrix: number[][] = [];

    for (const queryEmbedding of queryEmbeddings) {
      const row: number[] = [];
      for (const candidateEmbedding of candidateEmbeddings) {
        const similarity = this.calculateCosineSimilarity(
          queryEmbedding,
          candidateEmbedding
        );
        row.push(similarity);
      }
      similarityMatrix.push(row);
    }

    return similarityMatrix;
  }

  /**
   * Preprocess text for better matching
   */
  preprocessText(text: string): string {
    return (
      text
        .toLowerCase()
        // Remove common video quality indicators
        .replace(/\b(1080p|720p|480p|2160p|4k|uhd)\b/gi, "")
        // Remove common source indicators
        .replace(/\b(bluray|blu-ray|webdl|web-dl|webrip|hdtv|dvd)\b/gi, "")
        // Remove file extensions
        .replace(/\.(mkv|mp4|avi|wmv|mov)$/i, "")
        // Remove extra whitespace
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  /**
   * Calculate similarity with preprocessing
   */
  async calculateSimilarityPreprocessed(
    text1: string,
    text2: string
  ): Promise<number> {
    const processed1 = this.preprocessText(text1);
    const processed2 = this.preprocessText(text2);

    return this.calculateSimilarity(processed1, processed2);
  }
}

// Singleton instance
let aiMatchingServiceInstance: AIMatchingService | null = null;

export function createAIMatchingService(): AIMatchingService {
  if (!aiMatchingServiceInstance) {
    aiMatchingServiceInstance = new AIMatchingService();
  }
  return aiMatchingServiceInstance;
}

export function getAIMatchingService(): AIMatchingService | null {
  return aiMatchingServiceInstance;
}
