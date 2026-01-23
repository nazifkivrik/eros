/**
 * Scene Deduplication Utility
 * Filters duplicate scenes from TPDB results based on:
 * 1. Hash comparison (if available)
 * 2. Performer + Release date combination
 * 3. Studio code pattern matching (for JAV scenes)
 */

import type { Logger } from "pino";
import type { MetadataScene } from "../infrastructure/adapters/interfaces/metadata-provider.interface.js";

let logger: Logger | null = null;

export function setDeduplicatorLogger(log: Logger) {
  logger = log;
}

interface MappedScene {
  id: string;
  title: string;
  date?: string;
  code?: string;
  contentType?: "scene" | "jav" | "movie";
  duration?: number;
  performers?: Array<{ id: string; name: string }>;
  hashes?: Array<{ hash: string; type: string }>;
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
      logger?.info({ title: scene.title, duration: scene.duration }, "[Deduplicator] Skipping trailer");
      continue;
    }

    // 1. Hash-based deduplication (highest priority)
    if (scene.hashes && scene.hashes.length > 0) {
      const sceneHashKeys = scene.hashes.map(h => `${h.type}:${h.hash}`);

      // Check if any hash has been seen before
      const hasSeenHash = sceneHashKeys.some(hashKey => seenHashes.has(hashKey));

      if (hasSeenHash) {
        logger?.info({ title: scene.title }, "[Deduplicator] Duplicate by hash");
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
        logger?.info({ title: scene.title, date: scene.date }, "[Deduplicator] Duplicate by performer+date");
        isDuplicate = true;
      } else {
        seenPerformerDateCombos.add(comboKey);
      }
    }

    // 3. Studio code pattern matching for JAV content
    // Group scenes by base studio code and later filter
    if (!isDuplicate && scene.contentType === 'jav' && scene.code) {
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
      logger?.info({ baseCode, count: groupScenes.length }, "[Deduplicator] JAV code group variations found");
      const baseScene = groupScenes.reduce((shortest, current) => {
        const shortestCode = shortest.code || '';
        const currentCode = current.code || '';
        return currentCode.length < shortestCode.length ? current : shortest;
      });

      // Log removed scenes
      groupScenes.forEach(s => {
        if (s.id !== baseScene.id) {
          logger?.info({ title: s.title, code: s.code }, "[Deduplicator] Removing variant");
        }
      });
      logger?.info({ title: baseScene.title, code: baseScene.code }, "[Deduplicator] Keeping");

      uniqueScenes.push(baseScene);
    }
  }

  return uniqueScenes;
}

/**
 * Convert MetadataScene to MappedScene for deduplication
 * Extracts nested performer data to flat structure
 */
export function toMappedScene(scene: MetadataScene): MappedScene {
  // Handle performers - MetadataScene has nested structure: { performer: { id, name } }
  // Note: Some performers may not have an id field, use name as fallback
  const performers = scene.performers
    ?.map((p) => {
      // Extract from nested structure: { performer: { id, name } }
      if ("performer" in p && p.performer) {
        const performerId = p.performer.id || p.performer.name;
        logger?.debug({
          sceneId: scene.id,
          sceneTitle: scene.title,
          performerId: p.performer.id,
          performerName: p.performer.name,
          mappedId: performerId,
        }, "[Deduplicator] Mapping performer");
        return {
          id: performerId,
          name: p.performer.name,
        };
      }
      // Unknown structure - return null to filter out
      logger?.warn({
        sceneId: scene.id,
        performerData: JSON.stringify(p).slice(0, 200),
      }, "[Deduplicator] Unknown performer structure, filtering out");
      return null;
    })
    .filter(Boolean) as Array<{ id: string; name: string }> | undefined;

  const mapped = {
    id: scene.id,
    title: scene.title,
    date: scene.date,
    code: scene.code,
    contentType: scene.contentType,
    duration: scene.duration,
    performers,
    hashes: scene.hashes,
  };

  // Log mapping result for first scene
  if (logger && performers && performers.length > 0) {
    logger.debug({
      sceneId: scene.id,
      title: scene.title,
      date: scene.date,
      performerCount: performers.length,
      firstPerformerId: performers[0]?.id,
      performerIds: performers.map(p => p.id).join(','),
    }, "[Deduplicator] Mapped scene for deduplication");
  }

  return mapped;
}

/**
 * Deduplicate MetadataScene array
 * Convenience function that handles the conversion
 */
export function deduplicateMetadataScenes(scenes: MetadataScene[]): MetadataScene[] {
  if (scenes.length === 0) return scenes;

  // Convert to mapped format
  const mappedScenes = scenes.map(toMappedScene);

  // Deduplicate
  const uniqueMapped = deduplicateScenes(mappedScenes);

  // Get unique IDs
  const uniqueIds = new Set(uniqueMapped.map(s => s.id));

  // Filter original scenes to keep only unique ones
  return scenes.filter(s => uniqueIds.has(s.id));
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
