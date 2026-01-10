import { AutoTokenizer, AutoModelForSequenceClassification, env, type Tensor } from "@xenova/transformers";
import { logger } from "../utils/logger.js";
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
    logger.warn(`Failed to create AI model directory: ${modelDir}`, { error });
  }
} else {
  logger.info(`AI model directory exists: ${modelDir}`);
}

// Log the cache configuration
logger.info(`AI Model Cache Configuration:`, {
  cacheDir: env.cacheDir,
  localModelPath: env.localModelPath,
  allowLocalModels: env.allowLocalModels,
  modelDir,
});

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
  private readonly modelLoadTimeout = 300000; // 5 minutes for model download
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
            logger.debug(`Cache contents:`, { files, count: files.length });
          } catch (e) {
            logger.debug(`Could not list cache files: ${e}`);
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
      const score = this.sigmoid(logitValue);

      return score;
    } catch (error) {
      logger.error("Failed to score pair:", { error, query, candidate: candidate.id });
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

      // Reshape scores into matrix [queries x candidates]
      const scores: number[][] = [];
      let idx = 0;

      for (let i = 0; i < queries.length; i++) {
        const row: number[] = [];
        for (let j = 0; j < candidates.length; j++) {
          const logitValue = logits.data[idx] as number;
          row.push(this.sigmoid(logitValue));
          idx++;
        }
        scores.push(row);
      }

      return scores;
    } catch (error) {
      logger.error("Failed to score batch:", { error });
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

      // Find best score
      let bestIdx = 0;
      let bestScore = scores[0];

      for (let i = 1; i < scores.length; i++) {
        if (scores[i] > bestScore) {
          bestScore = scores[i];
          bestIdx = i;
        }
      }

      // Check threshold
      if (bestScore < threshold) {
        logger.debug("No match above threshold", {
          query: query.title,
          bestScore,
          threshold,
        });
        return null;
      }

      return {
        candidate: candidates[bestIdx],
        score: bestScore,
        index: bestIdx,
      };
    } catch (error) {
      logger.error("Failed to find best match:", { error, query });
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
      return scoreMatrix.map((scores, queryIdx) => {
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
      logger.error("Failed to batch find matches:", { error, queryCount: queries.length });
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
