/**
 * AI settings for scene matching
 */
export type AISettings = {
  enabled: boolean; // Enable AI-powered scene matching with local embeddings
  model: string; // Local embedding model (e.g., "Xenova/all-MiniLM-L6-v2")
  threshold: number; // Cosine similarity threshold for AI scene matching (0.0-1.0)
  groupingThreshold: number; // Cosine similarity threshold for AI torrent grouping and matching (0.0-1.0)
  levenshteinThreshold: number; // Similarity threshold for Levenshtein distance matching (0.0-1.0)
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  model: "Xenova/all-MiniLM-L6-v2", // Local sentence transformer model
  threshold: 0.75, // 75% cosine similarity for AI scene matching
  groupingThreshold: 0.92, // 92% cosine similarity for AI torrent grouping (strict to avoid false merges)
  levenshteinThreshold: 0.7, // 70% similarity for traditional string matching
};
