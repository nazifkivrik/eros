/**
 * Scene Deduplication Utility
 * Filters duplicate scenes from TPDB results based on:
 * 1. Hash comparison (if available)
 * 2. Performer + Release date combination
 * 3. Studio code pattern matching (for JAV scenes)
 */

import type { TPDBScene } from "../services/tpdb/tpdb.types.js";

interface MappedScene {
  id: string;
  tpdbId: string;
  title: string;
  date: string | null;
  code: string | null;
  tpdbContentType: string;
  duration?: number | null;
  performers?: Array<{ id: string; name: string }>;
  hashes?: Array<{ hash: string; type: string }>;
  studio?: { id: string; name: string } | null;
}

/**
 * Deduplicate scenes based on hash, performer+date, and studio code patterns
 * Also filters out trailers (videos shorter than 60 seconds)
 */
export function deduplicateScenes<T extends MappedScene>(scenes: T[]): T[] {
  if (scenes.length === 0) return scenes;

  const uniqueScenes: T[] = [];
  const seenHashes = new Set<string>();
  const seenPerformerDateCombos = new Set<string>();
  const studioCodeGroups = new Map<string, T[]>();

  for (const scene of scenes) {
    let isDuplicate = false;

    // Filter 0: Remove trailers (videos shorter than 60 seconds)
    if (scene.duration && scene.duration < 60) {
      console.log(`[Deduplicator] Skipping trailer: "${scene.title}" (${scene.duration}s)`);
      continue;
    }

    // 1. Hash-based deduplication (highest priority)
    if (scene.hashes && scene.hashes.length > 0) {
      const sceneHashKeys = scene.hashes.map(h => `${h.type}:${h.hash}`);

      // Check if any hash has been seen before
      const hasSeenHash = sceneHashKeys.some(hashKey => seenHashes.has(hashKey));

      if (hasSeenHash) {
        console.log(`[Deduplicator] Duplicate by hash: "${scene.title}"`);
        isDuplicate = true;
      } else {
        // Add all hashes to seen set
        sceneHashKeys.forEach(hashKey => seenHashes.add(hashKey));
      }
    }

    // 2. Performer + Date combination (if no hash or hash not duplicate)
    if (!isDuplicate && scene.performers && scene.performers.length > 0 && scene.date) {
      // Sort performer IDs to ensure consistent comparison
      const performerIds = scene.performers
        .map(p => p.id)
        .sort()
        .join(',');

      const comboKey = `${performerIds}:${scene.date}`;

      if (seenPerformerDateCombos.has(comboKey)) {
        console.log(`[Deduplicator] Duplicate by performer+date: "${scene.title}" (${scene.date})`);
        isDuplicate = true;
      } else {
        seenPerformerDateCombos.add(comboKey);
      }
    }

    // 3. Studio code pattern matching for JAV content
    // Group scenes by base studio code and later filter
    if (!isDuplicate && scene.tpdbContentType === 'jav' && scene.code) {
      const baseCode = extractBaseStudioCode(scene.code);

      if (baseCode) {
        if (!studioCodeGroups.has(baseCode)) {
          studioCodeGroups.set(baseCode, []);
        }
        studioCodeGroups.get(baseCode)!.push(scene);
        continue; // Skip adding to uniqueScenes for now - will be processed later
      }
      // If baseCode couldn't be extracted, fall through to add scene normally
    }

    // Add non-duplicate scenes (including JAV scenes without valid code patterns)
    if (!isDuplicate) {
      uniqueScenes.push(scene);
    }
  }

  // Process studio code groups - keep only the base pattern
  for (const [baseCode, groupScenes] of studioCodeGroups) {
    if (groupScenes.length === 1) {
      // Only one scene with this code, add it
      uniqueScenes.push(groupScenes[0]);
    } else {
      // Multiple scenes with similar codes - keep the shortest one (base pattern)
      console.log(`[Deduplicator] JAV code group "${baseCode}": ${groupScenes.length} variations found`);
      const baseScene = groupScenes.reduce((shortest, current) => {
        const shortestCode = shortest.code || '';
        const currentCode = current.code || '';
        return currentCode.length < shortestCode.length ? current : shortest;
      });

      // Log removed scenes
      groupScenes.forEach(s => {
        if (s.id !== baseScene.id) {
          console.log(`[Deduplicator]   - Removing variant: "${s.title}" (code: ${s.code})`);
        }
      });
      console.log(`[Deduplicator]   ✅ Keeping: "${baseScene.title}" (code: ${baseScene.code})`);

      uniqueScenes.push(baseScene);
    }
  }

  return uniqueScenes;
}

/**
 * Extract base studio code from JAV codes
 * Examples:
 * - rebdb-957tk1 -> rebdb-957
 * - rebdb-957 -> rebdb-957
 * - abc-123bd -> abc-123
 */
function extractBaseStudioCode(code: string): string | null {
  if (!code) return null;

  // Match pattern: letters-numbers followed by optional suffix
  // Pattern matches: prefix-number[suffix]
  const match = code.match(/^([a-zA-Z]+-\d+)/i);

  if (match) {
    return match[1].toLowerCase();
  }

  return null;
}

/**
 * Generate a unique key for scene comparison
 * Used for debugging and logging
 */
export function generateSceneKey(scene: MappedScene): string {
  if (scene.hashes && scene.hashes.length > 0) {
    return `hash:${scene.hashes[0].hash}`;
  }

  if (scene.performers && scene.performers.length > 0 && scene.date) {
    const performerIds = scene.performers
      .map(p => p.id)
      .sort()
      .join(',');
    return `perf-date:${performerIds}:${scene.date}`;
  }

  if (scene.code) {
    return `code:${scene.code}`;
  }

  return `id:${scene.id}`;
}

/**
 * Debug helper to analyze why scenes are considered duplicates
 */
export function analyzeSceneDuplicates<T extends MappedScene>(
  scenes: T[]
): {
  total: number;
  unique: number;
  removed: number;
  duplicateReasons: {
    hash: number;
    performerDate: number;
    studioCode: number;
  };
} {
  const original = scenes.length;
  const deduplicated = deduplicateScenes(scenes);
  const unique = deduplicated.length;

  // Simple approximation - for detailed analysis, would need to track during deduplication
  const hashDuplicates = scenes.filter(s => s.hashes && s.hashes.length > 0).length -
    deduplicated.filter(s => s.hashes && s.hashes.length > 0).length;

  const javScenes = scenes.filter(s => s.tpdbContentType === 'jav' && s.code).length;
  const uniqueJavScenes = deduplicated.filter(s => s.tpdbContentType === 'jav' && s.code).length;

  return {
    total: original,
    unique: unique,
    removed: original - unique,
    duplicateReasons: {
      hash: Math.max(0, hashDuplicates),
      performerDate: Math.max(0, original - unique - hashDuplicates - (javScenes - uniqueJavScenes)),
      studioCode: Math.max(0, javScenes - uniqueJavScenes),
    },
  };
}
