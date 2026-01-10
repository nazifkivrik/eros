/**
 * AI settings for scene matching
 */
export type AISettings = {
  useCrossEncoder: boolean; // Use Cross-Encoder for pair-wise ranking (more accurate but slower)
  crossEncoderThreshold: number; // Match threshold for Cross-Encoder (0.0-1.0)
  unknownThreshold: number; // Below this score, content is marked as unknown (0.0-1.0)
  groupingCount: number; // Number of top candidates to evaluate with Cross-Encoder
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  useCrossEncoder: true, // Cross-Encoder enabled by default
  crossEncoderThreshold: 0.65, // 65% confidence required for Cross-Encoder matches
  unknownThreshold: 0.35, // Below 35% confidence, mark as unknown/new content
  groupingCount: 10, // Evaluate top 10 candidates with Cross-Encoder
};
