/**
 * Metadata Discovery Job
 * Attempts to find StashDB metadata for scenes that were inferred from indexers
 * Runs daily at 3 AM
 */

import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { scenes } from "@repo/database";

export async function metadataDiscoveryJob(app: FastifyInstance) {
  app.log.info("Starting metadata discovery job");

  try {
    // Get scenes that were inferred from indexers and don't have metadata
    const metadataMissingScenes = await app.db.query.scenes.findMany({
      where: and(
        eq(scenes.hasMetadata, false),
        eq(scenes.inferredFromIndexers, true)
      ),
      limit: 50, // Process 50 scenes per run to avoid rate limiting
    });

    app.log.info(
      `Found ${metadataMissingScenes.length} metadata-missing scenes to process`
    );

    for (const scene of metadataMissingScenes) {
      try {
        await discoverMetadataForScene(app, scene);
      } catch (error) {
        app.log.error(
          { error, sceneId: scene.id, sceneTitle: scene.title },
          "Failed to discover metadata for scene"
        );
      }
    }

    app.log.info("Metadata discovery job completed");
  } catch (error) {
    app.log.error({ error }, "Metadata discovery job failed");
    throw error;
  }
}

async function discoverMetadataForScene(
  app: FastifyInstance,
  scene: any
) {
  app.log.info(
    { sceneId: scene.id, title: scene.title },
    "Attempting to discover metadata"
  );

  // Search StashDB using the scene title
  const searchResults = await app.stashdb.searchScenes(scene.title);

  if (searchResults.length === 0) {
    app.log.info(
      { sceneTitle: scene.title },
      "No StashDB results found for scene"
    );
    return;
  }

  // Try to find a match using title similarity (AI if available, fallback to simple matching)
  const bestMatch = await findBestMatch(app, scene.title, searchResults);

  if (!bestMatch) {
    app.log.info(
      { sceneTitle: scene.title },
      "No good match found in StashDB results"
    );
    return;
  }

  app.log.info(
    {
      sceneTitle: scene.title,
      matchedTitle: bestMatch.title,
      stashdbId: bestMatch.id,
    },
    "Found potential StashDB match"
  );

  // Get full scene details from StashDB
  const fullScene = await app.stashdb.getSceneById(bestMatch.id);

  if (!fullScene) {
    app.log.warn(
      { stashdbId: bestMatch.id },
      "Failed to fetch full scene details from StashDB"
    );
    return;
  }

  // Update scene with StashDB metadata
  await app.db
    .update(scenes)
    .set({
      title: fullScene.title,
      date: fullScene.date,
      duration: fullScene.duration,
      code: fullScene.code,
      images: fullScene.images || [],
      hasMetadata: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(scenes.id, scene.id));

  app.log.info(
    { sceneId: scene.id, stashdbId: fullScene.id },
    "Successfully linked scene to StashDB metadata"
  );
}

/**
 * Find best matching scene from search results
 * Uses AI matching if available, falls back to simple word overlap
 */
async function findBestMatch(
  app: FastifyInstance,
  queryTitle: string,
  results: any[]
): Promise<any | null> {
  // Use AI matching if available
  if (app.ai) {
    try {
      const candidates = results.map((r) => r.title);
      const match = await app.ai.findBestMatch(queryTitle, candidates, 0.8);

      if (match) {
        return results[match.index];
      }

      return null;
    } catch (error) {
      app.log.warn(
        { error },
        "AI matching failed, falling back to simple matching"
      );
      // Fall through to simple matching
    }
  }

  // Simple word overlap matching
  const normalizedQuery = normalizeTitle(queryTitle);

  let bestMatch = null;
  let bestScore = 0;

  for (const result of results) {
    const normalizedResult = normalizeTitle(result.title);
    const score = calculateSimilarity(normalizedQuery, normalizedResult);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = result;
    }
  }

  // Only return match if similarity is above 80%
  if (bestScore >= 0.8) {
    return bestMatch;
  }

  return null;
}

/**
 * Normalize title for comparison
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove special characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity between two strings (0-1)
 * Simple word overlap similarity
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(" "));
  const words2 = new Set(str2.split(" "));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}
