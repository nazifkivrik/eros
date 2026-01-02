/**
 * Shared types for scene matching logic
 */

/**
 * Result of a scene matching operation
 */
export interface MatchResult {
  scene: SceneMetadata;
  score: number; // 0-100 score indicating match quality
  method: MatchMethod; // Method used to find this match
  confidence: number; // Original similarity value (0-1)
}

/**
 * Matching method used
 */
export type MatchMethod = "exact" | "truncated" | "partial" | "ai" | "levenshtein";

/**
 * Settings for scene matching
 */
export interface MatchSettings {
  aiEnabled: boolean; // Whether AI matching is enabled
  aiThreshold: number; // AI cosine similarity threshold (0-1)
  groupingThreshold: number; // Threshold for torrent grouping and matching (0-1)
  levenshteinThreshold: number; // Levenshtein distance similarity threshold (0-1)
}

/**
 * Scene metadata for matching
 */
export interface SceneMetadata {
  id: string;
  title: string;
  date: string | null; // ISO date string or null
  performerIds?: string[];
  studioId?: string | null;
}

/**
 * Intermediate match result with method-specific info
 */
export interface MatchCandidate {
  scene: SceneMetadata;
  score: number;
  method: MatchMethod;
  confidence: number;
}
