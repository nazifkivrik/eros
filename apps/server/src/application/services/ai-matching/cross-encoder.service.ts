import { AutoTokenizer, AutoModelForSequenceClassification, env, type Tensor } from "@xenova/transformers";
import { logger } from "@/utils/logger.js";
import { mkdirSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";

// Configure cache directory for models
// Use absolute path /data/ai/models (same as DATABASE_PATH approach)
// In Docker: /data is mounted to ./data on host
// In development: falls back to workspace ./data/ai/models
const modelPath = process.env.AI_MODEL_PATH || "/data/ai/models";
env.cacheDir = modelPath;
env.localModelPath = modelPath;
env.allowLocalModels = true;

// Ensure the model directory exists
const modelDir = modelPath;
if (!existsSync(modelDir)) {
  try {
    mkdirSync(modelDir, { recursive: true });
    logger.info(`Created AI model directory: ${modelDir}`);
  } catch (error) {
    logger.warn({ error }, `Failed to create AI model directory: ${modelDir}`);
  }
} else {
  logger.info(`AI model directory exists: ${modelDir}`);
}

// Log the cache configuration
logger.info({
  cacheDir: env.cacheDir,
  localModelPath: env.localModelPath,
  allowLocalModels: env.allowLocalModels,
  modelDir,
}, "AI Model Cache Configuration:");

/**
 * Query structure for cross-encoder matching
 */
export interface MatchQuery {
  performer?: string;
  studio?: string;
  date?: string;
  title: string;
}

/**
 * Candidate structure for matching
 */
export interface Candidate {
  id: string;
  title: string;
  date?: string;
  studio?: string;
  performers?: string[];
}

/**
 * Match result with score
 */
export interface MatchResult {
  candidate: Candidate;
  score: number;
  index: number;
}

/**
 * Cross-Encoder Matching Service
 * Uses transformers.js with sequence classification for pair-wise ranking
 *
 * Cross-encoders take a query-candidate pair and output a relevance score.
 * Unlike bi-encoders (which create separate embeddings), cross-encoders
 * process both texts together, resulting in more accurate matching at the
 * cost of slower inference.
 */
export class CrossEncoderService {
  private model: any = null;
  private tokenizer: any = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private readonly modelName = "Xenova/ms-marco-MiniLM-L-6-v2";
  private readonly modelLoadTimeout = parseInt(process.env.AI_MODEL_TIMEOUT || "600000"); // 10 minutes default
  private loadError: Error | null = null;

  /**
   * Initialize the Cross-Encoder model and tokenizer
   * This is called automatically on first use
   * Timeout is set to 5 minutes to allow for large model downloads
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      const startTime = Date.now();
      try {
        logger.info(`🔄 Loading Cross-Encoder model: ${this.modelName}`);
        logger.info(`📁 Model cache path: ${modelPath}`);
        logger.info(`⏱️ Timeout: ${this.modelLoadTimeout}ms (${this.modelLoadTimeout / 1000}s)`);

        // Check if model directory exists and has files
        const cacheExists = existsSync(modelDir);

        if (cacheExists) {
          logger.info(`✅ Model cache directory exists: ${modelDir}`);
          // List files in cache for debugging
          try {
            const files = readdirSync(modelDir, { recursive: true });
            logger.debug({ files, count: files.length }, `Cache contents:`);
          } catch (e) {
            logger.debug({ error: e }, `Could not list cache files:`);
          }
        } else {
          logger.warn(`⚠️ Model cache directory NOT found, will download: ${modelDir}`);
        }

        // Set timeout for model loading
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model loading timeout after ${this.modelLoadTimeout}ms`)), this.modelLoadTimeout)
        );

        // Track whether we're downloading or loading from cache
        let hasDownloaded = false;

        // Load model and tokenizer with timeout
        logger.info(`📥 Starting model load (checking cache first)...`);
        const loadPromise = Promise.all([
          AutoModelForSequenceClassification.from_pretrained(this.modelName, {
            progress_callback: (progress: any) => {
              if (progress.status === "progress") {
                hasDownloaded = true;
                logger.debug(`Model download: ${(progress.progress * 100).toFixed(1)}%`);
              } else if (progress.status === "done") {
                hasDownloaded = true;
                logger.info(`✅ Model component saved to cache: ${progress.file}`);
              } else if (progress.status === "initiate") {
                if (!progress.file?.includes("onnx/model_quantized.onnx")) {
                  // Only log non-ONNX files to reduce noise (model is the big one)
                  logger.debug(`📥 Loading: ${progress.file}`);
                }
              }
            },
          }),
          AutoTokenizer.from_pretrained(this.modelName),
        ]);

        [this.model, this.tokenizer] = await Promise.race([loadPromise, timeoutPromise]);

        this.isInitialized = true;
        this.loadError = null;
        const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);

        if (hasDownloaded) {
          logger.info(`✅ Cross-Encoder model DOWNLOADED and loaded in ${loadTime}s`);
        } else {
          logger.info(`✅ Cross-Encoder model loaded from CACHE in ${loadTime}s`);
        }
        logger.info(`🎯 Model is ready for matching`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.loadError = error instanceof Error ? error : new Error(errorMsg);
        logger.error(`❌ Failed to load Cross-Encoder model: ${errorMsg}`);

        // Don't throw - allow the system to continue without AI matching
        logger.warn("⚠️ AI matching will be disabled for this session");
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Check if the model is successfully loaded
   */
  isModelLoaded(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the load error if any
   */
  getLoadError(): Error | null {
    return this.loadError;
  }

  /**
   * Construct multi-signal query string
   * Combines performer, studio, date, and title information
   * Example: "Performer: Jane Doe | Studio: X-Studio | Date: 2024-11-03 | Title: Scene Name"
   */
  private constructQuery(query: MatchQuery): string {
    const parts: string[] = [];

    if (query.performer) {
      parts.push(`Performer: ${query.performer}`);
    }
    if (query.studio) {
      parts.push(`Studio: ${query.studio}`);
    }
    if (query.date) {
      parts.push(`Date: ${query.date}`);
    }
    parts.push(`Title: ${query.title}`);

    return parts.join(" | ");
  }

  /**
   * Construct candidate document string
   * This represents the DATABASE SCENE we're comparing against
   * Should use same format as query for semantic consistency
   */
  private constructCandidate(candidate: Candidate): string {
    const parts: string[] = [];

    // Add performers if available
    if (candidate.performers && candidate.performers.length > 0) {
      parts.push(`Performer: ${candidate.performers.join(", ")}`);
    }

    // Add studio if available
    if (candidate.studio) {
      parts.push(`Studio: ${candidate.studio}`);
    }

    // Add date if available
    if (candidate.date) {
      parts.push(`Date: ${candidate.date}`);
    }

    // Add title
    parts.push(`Title: ${candidate.title}`);

    return parts.join(" | ");
  }

  /**
   * Normalize logit to probability using sigmoid function
   * sigmoid(x) = 1 / (1 + e^(-x))
   * Maps raw model output (-∞, +∞) to probability [0, 1]
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Calculate performer name matching penalty
   * Returns a penalty value [0-1] where:
   * - 0 = performer names match (no penalty)
   * - 0.5 = partial match (e.g., "Jade Hutchison" vs "Jade Hub")
   * - 0.9+ = no significant match (e.g., "John Doe" vs "Jane Smith")
   *
   * INCREASED PENALTY: With strict first-name matching, penalties are higher for mismatches
   */
  private calculatePerformerPenalty(queryPerformer: string, candidatePerformers: string[]): number {
    // Extract the main performer name (first word) from query
    // Query may be like "Jade Harper Jade Hutchison Jadehub" - we want just "Jade Harper"
    const normalizedQuery = this.normalizePerformerName(queryPerformer);
    const queryWords = normalizedQuery.split(' ').filter(w => w.length > 2);

    // Use first 2 words as main performer name (typically "First Last")
    let mainQueryName = queryWords.slice(0, 2).join(' ');
    if (mainQueryName.length < 3) {
      mainQueryName = queryWords[0] || normalizedQuery;
    }

    // Check each candidate performer for match
    let bestMatchScore = 0;

    for (const candidatePerformer of candidatePerformers) {
      const normalizedCandidate = this.normalizePerformerName(candidatePerformer);
      const matchScore = this.calculatePerformerSimilarity(mainQueryName, normalizedCandidate);
      bestMatchScore = Math.max(bestMatchScore, matchScore);
    }

    // Convert match score to penalty (high match = low penalty)
    // With strict first-name matching, the scores are now more meaningful:
    // - >= 0.7 = first names match, good overall match -> no penalty
    // - 0.3-0.7 = partial match (maybe first name typo or missing last name) -> moderate penalty
    // - < 0.3 = first names don't match -> HEAVY penalty
    if (bestMatchScore >= 0.7) {
      return 0; // No penalty - performers match
    } else if (bestMatchScore >= 0.3) {
      // Partial match - significant penalty
      return 0.6 * (1 - bestMatchScore);
    } else {
      // First names don't match - VERY heavy penalty
      // This should cause the match to fail threshold
      return 0.95;
    }
  }

  /**
   * Normalize performer name for comparison
   * Removes common suffixes/prefixes and normalizes spacing
   */
  private normalizePerformerName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      // Remove common suffixes
      .replace(/\s+(aka|aka\.|also known as)\s.*$/i, "")
      // Remove special characters but keep spaces
      .replace(/[^\w\s]/g, "")
      // Normalize multiple spaces
      .replace(/\s+/g, " ");
  }

  /**
   * Calculate similarity between two performer names
   * Returns a score [0-1] where 1 = exact match, 0 = no match
   *
   * STRICT MATCHING: First name MUST match for high similarity scores
   * This prevents false matches like "Jade Harper" vs "Jada Harper"
   */
  private calculatePerformerSimilarity(name1: string, name2: string): number {
    // Exact match
    if (name1 === name2) {
      return 1.0;
    }

    // Split into words for analysis
    const words1 = name1.split(" ").filter((w) => w.length > 0);
    const words2 = name2.split(" ").filter((w) => w.length > 0);

    if (words1.length === 0 || words2.length === 0) {
      return this.levenshteinSimilarity(name1, name2);
    }

    // STRICT CHECK: First names (first word) must match EXACTLY (case-insensitive)
    // This prevents "Jade Harper" from matching "Jada Harper"
    const firstName1 = words1[0].toLowerCase();
    const firstName2 = words2[0].toLowerCase();

    if (firstName1 !== firstName2) {
      // First names don't match - return LOW similarity
      // Still allow some similarity for edge cases (typos, slight variations)
      const stringSim = this.levenshteinSimilarity(name1, name2);

      // If first names are very similar (e.g., "Jade" vs "Jade" with special chars), allow moderate score
      if (firstName1.length > 3 && this.levenshteinSimilarity(firstName1, firstName2) > 0.9) {
        return stringSim * 0.5; // Max 0.5 similarity if first names are close but not exact
      }

      // First names are different - heavily penalize
      return stringSim * 0.2; // Max 0.2 similarity for different first names
    }

    // First names match exactly - now check remaining words
    // Check if one is contained in the other (e.g., "Jade" vs "Jade Hutchison")
    if (name1.includes(name2) || name2.includes(name1)) {
      const longer = name1.length > name2.length ? name1 : name2;
      if (longer.length <= 15) {
        return 0.9;
      }
    }

    // Count matching words (excluding first name which we already confirmed matches)
    let matchingWords = 1; // Start with 1 for the matching first name
    for (let i = 1; i < words1.length; i++) {
      for (let j = 1; j < words2.length; j++) {
        if (words1[i].toLowerCase() === words2[j].toLowerCase()) {
          matchingWords++;
          break;
        }
      }
    }

    const wordOverlap = matchingWords / Math.max(words1.length, words2.length);

    // If we have significant word overlap, check if the FULL names match well
    if (wordOverlap > 0) {
      const stringSim = this.levenshteinSimilarity(name1, name2);
      // Both word overlap AND string similarity must be high for a good match
      return (wordOverlap * 0.6) + (stringSim * 0.4);
    }

    return this.levenshteinSimilarity(name1, name2);
  }

  /**
   * Calculate Levenshtein-based string similarity
   */
  private levenshteinSimilarity(str1: string, str2: string): number {
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
   * Score a single (query, candidate) pair
   * Returns normalized score [0-1] where:
   * - > 0.7 = strong match
   * - 0.4-0.7 = uncertain
   * - < 0.4 = no match
   */
  async scorePair(query: MatchQuery, candidate: Candidate): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const queryStr = this.constructQuery(query);
      const candidateStr = this.constructCandidate(candidate);

      // Tokenize the pair
      // text_pair parameter tells the tokenizer to create proper [CLS] query [SEP] candidate [SEP] format
      const inputs = await this.tokenizer([queryStr], {
        text_pair: [candidateStr],
        padding: true,
        truncation: true,
        return_tensors: "pt", // Return as tensors
      });

      // Run inference
      const outputs = await this.model(inputs);

      // Extract logit (raw score) from model output
      // For sequence classification, logits are in outputs.logits
      const logits = outputs.logits as Tensor;
      const logitValue = logits.data[0] as number;

      // Normalize to [0, 1] using sigmoid
      let score = this.sigmoid(logitValue);

      // Apply performer name validation penalty
      // If query has a performer but candidate performers don't contain it, heavily penalize
      if (query.performer && candidate.performers && candidate.performers.length > 0) {
        const performerPenalty = this.calculatePerformerPenalty(query.performer, candidate.performers);
        if (performerPenalty > 0) {
          score = score * (1 - performerPenalty);
          logger.info({
            queryPerformer: query.performer,
            candidatePerformers: candidate.performers,
            originalScore: this.sigmoid(logitValue),
            penalty: performerPenalty,
            finalScore: score,
          }, "🎯 Performer penalty applied - names don't match well");
        }
      }

      return score;
    } catch (error) {
      logger.error({ error, query, candidate: candidate.id }, "Failed to score pair:");
      throw error;
    }
  }

  /**
   * Score multiple pairs in batch
   * More efficient than calling scorePair multiple times
   */
  async scoreBatch(
    queries: MatchQuery[],
    candidates: Candidate[]
  ): Promise<number[][]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (queries.length === 0 || candidates.length === 0) {
      return [];
    }

    try {
      // Build all query-candidate pairs
      const queryStrings: string[] = [];
      const candidateStrings: string[] = [];

      for (const query of queries) {
        for (const candidate of candidates) {
          queryStrings.push(this.constructQuery(query));
          candidateStrings.push(this.constructCandidate(candidate));
        }
      }

      // Tokenize all pairs at once
      const inputs = await this.tokenizer(queryStrings, {
        text_pair: candidateStrings,
        padding: true,
        truncation: true,
        return_tensors: "pt",
      });

      // Run batch inference
      const outputs = await this.model(inputs);
      const logits = outputs.logits as Tensor;

      // Reshape scores into matrix [queries x candidates] and apply penalties
      const scores: number[][] = [];
      let idx = 0;

      // Debug: log first query/candidate to see structure
      if (queries.length > 0 && candidates.length > 0) {
        logger.info({
          sampleQuery: queries[0],
          sampleCandidate: candidates[0],
          totalQueries: queries.length,
          totalCandidates: candidates.length,
        }, "🔍 Batch scoring input structure");
      }

      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        const row: number[] = [];
        for (let j = 0; j < candidates.length; j++) {
          const candidate = candidates[j];
          const logitValue = logits.data[idx] as number;
          let score = this.sigmoid(logitValue);

          // Apply performer name validation penalty (same logic as scorePair)
          if (query.performer && candidate.performers && candidate.performers.length > 0) {
            const performerPenalty = this.calculatePerformerPenalty(query.performer, candidate.performers);

            // Also apply title similarity penalty - if titles are very different, reduce score
            // Use Levenshtein similarity for titles (NOT calculatePerformerSimilarity which is for names)
            let titlePenalty = 0;
            if (query.title && candidate.title) {
              // Use levenshteinSimilarity for general string comparison
              const titleSim = this.levenshteinSimilarity(query.title, candidate.title);
              // If title similarity is very low (<0.3), apply penalty
              if (titleSim < 0.3) {
                titlePenalty = 0.5 * (1 - titleSim);
                logger.info({
                  queryTitle: query.title,
                  candidateTitle: candidate.title,
                  titleSimilarity: titleSim,
                  titlePenalty,
                }, "🔍 Title penalty applied - titles don't match");
              }
            }

            const totalPenalty = Math.max(performerPenalty, titlePenalty);

            if (totalPenalty > 0) {
              const originalScore = score;
              score = score * (1 - totalPenalty);
              logger.info({
                queryPerformer: query.performer,
                candidatePerformers: candidate.performers,
                queryTitle: query.title,
                candidateTitle: candidate.title,
                originalScore,
                performerPenalty,
                titlePenalty,
                totalPenalty,
                finalScore: score,
              }, "🎯 Penalty applied - performers or titles don't match");
            }
          }

          row.push(score);
          idx++;
        }
        scores.push(row);
      }

      return scores;
    } catch (error) {
      logger.error({ error }, "Failed to score batch:");
      throw error;
    }
  }

  /**
   * Find best matching candidate for a query
   * Returns null if no candidate exceeds the threshold
   * Uses batch scoring internally for efficiency
   */
  async findBestMatch(
    query: MatchQuery,
    candidates: Candidate[],
    threshold = 0.7
  ): Promise<MatchResult | null> {
    if (candidates.length === 0) {
      return null;
    }

    try {
      // Use batch scoring for efficiency (single model call)
      const scoreMatrix = await this.scoreBatch([query], candidates);
      const scores = scoreMatrix[0] || [];

      if (scores.length === 0) {
        return null;
      }

      // Find best score and also track top 3 for debugging
      let bestIdx = 0;
      let bestScore = scores[0];

      for (let i = 1; i < scores.length; i++) {
        if (scores[i] > bestScore) {
          bestScore = scores[i];
          bestIdx = i;
        }
      }

      // Sort candidates by score to get top 3
      const sortedCandidates = candidates.map((c, i) => ({ candidate: c, score: scores[i], index: i }))
        .sort((a, b) => b.score - a.score);

      // Check threshold
      if (bestScore < threshold) {
        logger.info({
          query: query.title,
          bestScore,
          threshold,
          top3: sortedCandidates.slice(0, 3).map(({ candidate, score }) => ({ title: candidate.title, score })),
        }, "✗ No match above threshold");
        return null;
      }

      logger.info({
        query: query.title,
        matchedTitle: candidates[bestIdx].title,
        score: bestScore,
        threshold,
        top3: sortedCandidates.slice(0, 3).map(({ candidate, score }) => ({ title: candidate.title, score })),
      }, "✓ Best match found");

      return {
        candidate: candidates[bestIdx],
        score: bestScore,
        index: bestIdx,
      };
    } catch (error) {
      logger.error({ error, query }, "Failed to find best match:");
      throw error;
    }
  }

  /**
   * Batch size limit for scoring (to prevent memory issues)
   * 5000 pairs = ~10 queries * 500 candidates
   */
  private readonly BATCH_SIZE = 5000;

  /**
   * Find best matches for multiple queries at once
   * Much more efficient than calling findBestMatch multiple times
   * Automatically chunks large batches to prevent memory issues
   */
  async findBestMatchBatch(
    queries: MatchQuery[],
    candidates: Candidate[],
    threshold = 0.7
  ): Promise<Array<MatchResult | null>> {
    if (queries.length === 0 || candidates.length === 0) {
      return queries.map(() => null);
    }

    const totalPairs = queries.length * candidates.length;

    // Chunk if necessary
    if (totalPairs > this.BATCH_SIZE) {
      return this.findBestMatchChunked(queries, candidates, threshold);
    }

    try {
      // Score all query-candidate pairs in one batch
      const scoreMatrix = await this.scoreBatch(queries, candidates);

      // Find best match for each query
      return scoreMatrix.map((scores, _queryIdx) => {
        if (scores.length === 0) return null;

        let bestIdx = 0;
        let bestScore = scores[0];

        for (let i = 1; i < scores.length; i++) {
          if (scores[i] > bestScore) {
            bestScore = scores[i];
            bestIdx = i;
          }
        }

        if (bestScore < threshold) {
          return null;
        }

        return {
          candidate: candidates[bestIdx],
          score: bestScore,
          index: bestIdx,
        };
      });
    } catch (error) {
      logger.error({ error, queryCount: queries.length }, "Failed to batch find matches:");
      throw error;
    }
  }

  /**
   * Internal method: chunk large batches to stay within memory limits
   */
  private async findBestMatchChunked(
    queries: MatchQuery[],
    candidates: Candidate[],
    threshold: number
  ): Promise<Array<MatchResult | null>> {
    const queriesPerChunk = Math.max(1, Math.floor(this.BATCH_SIZE / candidates.length));
    const results: Array<MatchResult | null> = [];

    logger.info(`Chunking ${queries.length} queries into batches of ${queriesPerChunk}`);

    for (let i = 0; i < queries.length; i += queriesPerChunk) {
      const chunkQueries = queries.slice(i, i + queriesPerChunk);
      const chunkResults = await this.findBestMatchBatch(chunkQueries, candidates, threshold);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Classify match quality based on score
   * - matched: score >= 0.65 (high confidence)
   * - uncertain: 0.35 <= score < 0.65 (auto-download as metadata-less if indexer count >= 3)
   * - unknown: score < 0.35 (auto-download as metadata-less if indexer count >= 3)
   */
  classifyMatch(score: number, matchThreshold = 0.65, unknownThreshold = 0.35): "matched" | "uncertain" | "unknown" {
    if (score >= matchThreshold) return "matched";
    if (score >= unknownThreshold) return "uncertain";
    return "unknown";
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if model files are downloaded to disk
   * Returns true if model exists in cache directory
   */
  isModelDownloaded(): boolean {
    try {
      // Check if cache directory exists
      if (!existsSync(modelDir)) {
        return false;
      }

      // Check for model files - transformers.js stores models as:
      // {cacheDir}/{modelName}/config.json
      // {cacheDir}/{modelName}/onnx/model_quantized.onnx
      const modelCacheDir = join(modelDir, this.modelName);

      if (!existsSync(modelCacheDir)) {
        return false;
      }

      const configPath = join(modelCacheDir, "config.json");
      const modelPath = join(modelCacheDir, "onnx", "model_quantized.onnx");

      return existsSync(configPath) && existsSync(modelPath);
    } catch (error) {
      logger.error({ error }, "Failed to check if model is downloaded");
      return false;
    }
  }

  /**
   * Unload model from RAM to free memory
   * Model files remain on disk for future use
   * Call this after matching is complete to free up RAM
   */
  unload(): void {
    if (!this.isInitialized) {
      logger.debug("Model not loaded, nothing to unload");
      return;
    }

    logger.info("Unloading Cross-Encoder model from RAM...");

    // Clear references to model and tokenizer
    this.model = null;
    this.tokenizer = null;
    this.isInitialized = false;
    this.initializationPromise = null;

    logger.info("✅ Model unloaded from RAM (files preserved on disk)");
  }

  /**
   * Execute matching with auto load/unload
   * Loads model before matching, unloads after completion
   * This is the recommended way to use the service for memory efficiency
   */
  async withAutoLoad<T>(
    matchingFn: () => Promise<T>
  ): Promise<T> {
    try {
      // Model will be auto-loaded on first use (lazy load in scorePair/scoreBatch)
      const result = await matchingFn();
      return result;
    } finally {
      // Always unload after matching is complete, regardless of success/failure
      this.unload();
    }
  }

  /**
   * Get model name
   */
  getModelName(): string {
    return this.modelName;
  }

  /**
   * Get model cache path (absolute)
   */
  getModelPath(): string {
    return modelDir;
  }
}

// Singleton instance
let crossEncoderInstance: CrossEncoderService | null = null;

/**
 * Get or create singleton instance
 * Model is loaded once and reused across all requests
 */
export function createCrossEncoderService(): CrossEncoderService {
  if (!crossEncoderInstance) {
    crossEncoderInstance = new CrossEncoderService();
  }
  return crossEncoderInstance;
}

/**
 * Get existing instance (may be null if not yet created)
 */
export function getCrossEncoderService(): CrossEncoderService | null {
  return crossEncoderInstance;
}
