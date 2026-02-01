import { nanoid } from "nanoid";
import type { Logger } from "pino";
import { ScenesRepository } from "@/infrastructure/repositories/scenes.repository.js";
import { PerformersRepository } from "@/infrastructure/repositories/performers.repository.js";
import { SubscriptionsRepository } from "@/infrastructure/repositories/subscriptions.repository.js";
import { scenes, performers, studios, performersScenes } from "@repo/database";
import type { Database } from "@repo/database";
import { eq } from "drizzle-orm";

/**
 * DTOs for Subscriptions Scenes Service
 */
export interface SaveSceneDTO {
  externalId: string;
  source: string;
  title: string;
  date?: string;
  contentType?: "scene" | "jav" | "movie";
  code?: string;
  slug: string;
  duration?: number;
  images?: Array<{ url: string; width?: number; height?: number }>;
  poster?: string;
  backImage?: string;
  thumbnail?: string;
  background?: {
    full: string | null;
    large: string | null;
    medium: string | null;
    small: string | null;
  };
  description?: string;
  studioId?: string;
  studioTpdbData?: any;
  performerTpdbData?: any[];
}

export interface LinkScenePerformersDTO {
  sceneId: string;
  entityType: "performer" | "studio";
  entityId: string;
  performers?: any[];
}

/**
 * Subscriptions Scenes Service
 * Business logic for scene operations (save, link, deduplicate)
 * Pure business logic - no HTTP concerns
 */
export class SubscriptionsScenesService {
  private scenesRepository: ScenesRepository;
  private performersRepository: PerformersRepository;
  private subscriptionsRepository: SubscriptionsRepository;
  private db: Database;
  private logger: Logger;

  constructor({
    scenesRepository,
    performersRepository,
    subscriptionsRepository,
    db,
    logger,
  }: {
    scenesRepository: ScenesRepository;
    performersRepository: PerformersRepository;
    subscriptionsRepository: SubscriptionsRepository;
    db: Database;
    logger: Logger;
  }) {
    this.scenesRepository = scenesRepository;
    this.performersRepository = performersRepository;
    this.subscriptionsRepository = subscriptionsRepository;
    this.db = db;
    this.logger = logger;
  }

  /**
   * Find duplicate scenes before saving
   * Returns existing scene ID if duplicate found, null otherwise
   */
  async findDuplicateScene(dto: SaveSceneDTO): Promise<string | null> {
    this.logger.info({ title: dto.title }, "Checking for duplicate scene");

    // 1. Check by external ID (highest confidence)
    if (dto.externalId && dto.source) {
      const existingByExternalId = await this.scenesRepository.findByTpdbId(dto.externalId);
      if (existingByExternalId) {
        this.logger.info({ sceneId: existingByExternalId.id }, "Duplicate found by external ID");
        return existingByExternalId.id;
      }
    }

    // 2. Check by title + date combination (very likely duplicate)
    if (dto.title && dto.date) {
      const existingByTitleDate = await this.scenesRepository.findByTitleAndDate(
        dto.title,
        dto.date
      );
      if (existingByTitleDate) {
        this.logger.info({ sceneId: existingByTitleDate.id }, "Duplicate found by title+date");
        return existingByTitleDate.id;
      }
    }

    // 3. Check by JAV code (for JAV content)
    if (dto.contentType === "jav" && dto.code) {
      const baseCode = this.extractBaseJavCode(dto.code);
      if (baseCode) {
        const javScenes = await this.scenesRepository.findJavScenesWithCodes();
        for (const javScene of javScenes) {
          if (javScene.code) {
            const existingBaseCode = this.extractBaseJavCode(javScene.code);
            if (existingBaseCode === baseCode) {
              this.logger.info(
                { sceneId: javScene.id, code: baseCode },
                "Duplicate found by JAV code"
              );
              return javScene.id;
            }
          }
        }
      }
    }

    this.logger.info("No duplicate found");
    return null;
  }

  /**
   * Save scene from metadata to database
   * Returns scene ID (existing if duplicate, newly created otherwise)
   */
  async saveSceneFromMetadata(dto: SaveSceneDTO): Promise<string> {
    this.logger.info({ title: dto.title }, "Saving scene from metadata");

    // Check for duplicates first
    const duplicateId = await this.findDuplicateScene(dto);
    if (duplicateId) {
      return duplicateId;
    }

    // Determine studio ID for the scene
    let studioIdForScene: string | null | undefined = dto.studioId;

    // Create studio from TPDB data if provided
    if (dto.studioTpdbData && !studioIdForScene) {
      studioIdForScene = await this.getOrCreateStudioFromTpdb(dto.studioTpdbData);
    }

    // Generate slug if not provided
    const sceneSlug = dto.slug || this.generateSlug(dto.title, dto.date, dto.code);

    // Prepare scene data - only include siteId if it exists
    const sceneData: typeof scenes.$inferInsert = {
      id: nanoid(),
      externalIds: [{ source: dto.source, id: dto.externalId }],
      slug: sceneSlug,
      contentType: dto.contentType || "scene",
      title: dto.title,
      description: dto.description,
      date: dto.date,
      duration: dto.duration,
      code: dto.code,
      images: dto.images || [],
      poster: dto.poster,
      backImage: dto.backImage,
      thumbnail: dto.thumbnail,
      // Don't include background if it's a string (schema expects JSON object)
      // background: dto.background,
      hasMetadata: true,
      inferredFromIndexers: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Only add siteId if we have one (let DB use default/NULL if not)
    if (studioIdForScene) {
      sceneData.siteId = studioIdForScene;
    }

    // Create new scene
    const sceneId = sceneData.id;
    await this.scenesRepository.create(sceneData);

    this.logger.info({ sceneId, title: dto.title }, "Scene created successfully");
    return sceneId;
  }

  /**
   * Generate a URL-friendly slug from scene title
   */
  private generateSlug(title: string, date?: string, code?: string): string {
    const parts: string[] = [];

    // Add code if available (most specific)
    if (code) {
      parts.push(code.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    } else {
      // Otherwise use title
      const titleSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      parts.push(titleSlug);
    }

    // Add date if available to make slug unique
    if (date) {
      parts.push(date);
    }

    return parts.join('-');
  }

  /**
   * Link scene to performers and studios
   * Enhanced: Skips duplicate performers that match the main subscription performer
   */
  async linkScenePerformers(dto: LinkScenePerformersDTO): Promise<void> {
    this.logger.info({ sceneId: dto.sceneId }, "Linking scene performers");

    // Get the main subscription performer's data to avoid duplicates
    let mainPerformerTpdbId: string | null = null;
    let mainPerformerName: string | null = null;
    let mainPerformerAliases: string[] = [];

    if (dto.entityType === "performer") {
      const mainPerformer = await this.db.query.performers.findFirst({
        where: eq(performers.id, dto.entityId),
      });

      if (mainPerformer) {
        mainPerformerTpdbId = mainPerformer.externalIds.find(e => e.source === "tpdb")?.id || null;
        mainPerformerName = mainPerformer.name;
        mainPerformerAliases = mainPerformer.aliases || [];

        // Link the main performer to the scene
        await this.scenesRepository.linkPerformerToScene(dto.entityId, dto.sceneId);
        this.logger.info({ performerId: dto.entityId, name: mainPerformerName }, "Linked subscription performer to scene");
      }
    }

    // Link other performers from scene metadata
    if (dto.performers && dto.performers.length > 0) {
      let linkedCount = 0;
      let skippedCount = 0;

      for (const tpdbPerformerWrapper of dto.performers) {
        // TPDB adapter wraps performer in {performer: {...}} format
        const tpdbPerformer = 'performer' in tpdbPerformerWrapper
          ? (tpdbPerformerWrapper as any).performer
          : tpdbPerformerWrapper;

        // Skip if this is the same as the main subscription performer
        if (mainPerformerTpdbId && tpdbPerformer.id === mainPerformerTpdbId) {
          this.logger.debug({
            tpdbId: tpdbPerformer.id,
            name: tpdbPerformer.name,
          }, "Skipping performer - same as main subscription performer (by TPDB ID)");
          skippedCount++;
          continue;
        }

        // Skip if name matches (handles cases where TPDB has duplicate entries with different IDs)
        if (mainPerformerName) {
          const normalizedName = this.normalizePerformerName(tpdbPerformer.name);
          const normalizedMainName = this.normalizePerformerName(mainPerformerName);
          const normalizedAliases = mainPerformerAliases.map(a => this.normalizePerformerName(a));

          if (normalizedName === normalizedMainName || normalizedAliases.includes(normalizedName)) {
            this.logger.debug({
              tpdbName: tpdbPerformer.name,
              mainName: mainPerformerName,
            }, "Skipping performer - name matches main subscription performer");
            skippedCount++;
            continue;
          }
        }

        const performerId = await this.getOrCreatePerformerFromTpdb(tpdbPerformer);
        if (performerId) {
          await this.scenesRepository.linkPerformerToScene(performerId, dto.sceneId);
          linkedCount++;
        }
      }

      this.logger.info(
        { total: dto.performers.length, linked: linkedCount, skipped: skippedCount },
        "Linked additional performers to scene"
      );
    }
  }

  /**
   * Update scene with new external data
   */
  async updateSceneWithExternalData(sceneId: string, externalData: Partial<SaveSceneDTO>): Promise<void> {
    this.logger.info({ sceneId }, "Updating scene with external data");

    const exists = await this.scenesRepository.exists(sceneId);
    if (!exists) {
      throw new Error("Scene not found");
    }

    await this.scenesRepository.update(sceneId, {
      updatedAt: new Date().toISOString(),
      // Only update fields that are provided
      ...(externalData.title && { title: externalData.title }),
      ...(externalData.description && { description: externalData.description }),
      ...(externalData.date && { date: externalData.date }),
      ...(externalData.duration && { duration: externalData.duration }),
      ...(externalData.code && { code: externalData.code }),
      ...(externalData.images && { images: externalData.images }),
      ...(externalData.poster && { poster: externalData.poster }),
      ...(externalData.backImage && { backImage: externalData.backImage }),
      ...(externalData.thumbnail && { thumbnail: externalData.thumbnail }),
      ...(externalData.background && { background: externalData.background }),
    });

    this.logger.info({ sceneId }, "Scene updated successfully");
  }

  /**
   * Get or create studio from TPDB data
   */
  private async getOrCreateStudioFromTpdb(tpdbStudio: any): Promise<string | null> {
    const allStudios = await this.db.query.studios.findMany();
    let studioRecord = allStudios.find((s) =>
      s.externalIds.some((ext) => ext.source === "tpdb" && ext.id === tpdbStudio.id)
    );

    if (studioRecord) {
      return studioRecord.id;
    }

    // Name is required - skip studio if missing
    const studioName = tpdbStudio.name;
    if (!studioName || studioName.trim() === '') {
      this.logger.warn({ tpdbId: tpdbStudio.id }, "Skipping studio with no name");
      return null;
    }

    // Generate slug from name if not provided
    let slug = tpdbStudio.slug;
    if (!slug || slug.trim() === '') {
      slug = studioName
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }

    // Final fallback - use TPDB ID as slug if name generated empty slug
    if (!slug || slug.trim() === '') {
      slug = `studio-${tpdbStudio.id}`;
    }

    // Create studio if doesn't exist
    const studioId = nanoid();
    await this.db.insert(studios).values({
      id: studioId,
      externalIds: [{ source: "tpdb", id: tpdbStudio.id }],
      name: studioName,
      slug,
      url: tpdbStudio.url,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.logger.info({ studioId, name: studioName }, "Created new studio");
    return studioId;
  }

  /**
   * Get or create performer from TPDB data
   * Enhanced with name-based duplicate detection
   */
  private async getOrCreatePerformerFromTpdb(tpdbPerformer: any): Promise<string | null> {
    const allPerformers = await this.db.query.performers.findMany();

    // First, try to find by TPDB ID (exact match)
    let performerRecord = allPerformers.find((p) =>
      p.externalIds.some((ext) => ext.source === "tpdb" && ext.id === tpdbPerformer.id)
    );

    // If not found by TPDB ID, try name-based matching
    // This handles cases where TPDB has duplicate entries with different IDs but same/similar names
    if (!performerRecord) {
      const normalizedName = this.normalizePerformerName(tpdbPerformer.name);
      const tpdbAliases = (tpdbPerformer.aliases || []).map((a: string) => this.normalizePerformerName(a));

      performerRecord = allPerformers.find((p) => {
        const existingName = this.normalizePerformerName(p.name);
        const existingAliases = (p.aliases || []).map((a: string) => this.normalizePerformerName(a));

        // Match if:
        // 1. Names match exactly (normalized)
        // 2. Name matches any existing alias
        // 3. Any alias matches existing name
        // 4. Any alias matches any existing alias
        return (
          existingName === normalizedName ||
          existingAliases.includes(normalizedName) ||
          tpdbAliases.includes(existingName) ||
          tpdbAliases.some((ta: string) => existingAliases.includes(ta))
        );
      });

      if (performerRecord) {
        this.logger.info({
          existingPerformerId: performerRecord.id,
          existingName: performerRecord.name,
          tpdbId: tpdbPerformer.id,
          tpdbName: tpdbPerformer.name,
        }, "Found existing performer by name/alias match - merging TPDB entries");
      }
    }

    if (performerRecord) {
      // If we found by name match (not TPDB ID), add the new TPDB ID to external IDs
      const hasThisTpdbId = performerRecord.externalIds.some(
        (ext) => ext.source === "tpdb" && ext.id === tpdbPerformer.id
      );

      if (!hasThisTpdbId) {
        this.logger.info({
          performerId: performerRecord.id,
          existingTpdbIds: performerRecord.externalIds.filter(e => e.source === "tpdb").map(e => e.id),
          newTpdbId: tpdbPerformer.id,
        }, "Adding additional TPDB ID to existing performer");

        // Merge the new TPDB ID into external IDs
        const mergedExternalIds = [
          ...performerRecord.externalIds,
          { source: "tpdb" as const, id: tpdbPerformer.id }
        ];

        await this.db.update(performers)
          .set({
            externalIds: mergedExternalIds,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(performers.id, performerRecord.id));
      }

      // Update aliases if they differ from TPDB
      const currentAliases = performerRecord.aliases || [];
      const tpdbAliases = tpdbPerformer.aliases || [];

      // DEBUG: Log TPDB response
      this.logger.info({
        performerId: performerRecord.id,
        performerName: performerRecord.name,
        tpdbId: tpdbPerformer.id,
        tpdbAliases: tpdbAliases,
        currentAliases: currentAliases,
        tpdbRaw: JSON.stringify(tpdbPerformer),
      }, "DEBUG: TPDB Performer Data");

      // Check if aliases need updating
      const aliasesChanged = JSON.stringify(currentAliases.sort()) !== JSON.stringify(tpdbAliases.sort());

      if (aliasesChanged) {
        await this.db.update(performers)
          .set({
            aliases: tpdbAliases,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(performers.id, performerRecord.id));

        this.logger.info({
          performerId: performerRecord.id,
          oldAliases: currentAliases,
          newAliases: tpdbAliases,
        }, "Updated performer aliases from TPDB");
      }

      return performerRecord.id;
    }

    // Name is required - skip performer if missing
    const performerName = tpdbPerformer.name || tpdbPerformer.fullName;
    if (!performerName || performerName.trim() === '') {
      this.logger.warn({ tpdbId: tpdbPerformer.id }, "Skipping performer with no name");
      return null;
    }

    // Generate slug from name if not provided
    let slug = tpdbPerformer.slug;
    if (!slug || slug.trim() === '') {
      slug = performerName
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }

    // Final fallback - use TPDB ID as slug if name generated empty slug
    if (!slug || slug.trim() === '') {
      slug = `performer-${tpdbPerformer.id}`;
    }

    // Create performer if doesn't exist
    const performerId = nanoid();
    await this.db.insert(performers).values({
      id: performerId,
      externalIds: [{ source: "tpdb", id: tpdbPerformer.id }],
      name: performerName,
      fullName: tpdbPerformer.fullName || performerName,
      slug,
      aliases: tpdbPerformer.aliases || [], // ✅ FIX: Save aliases!
      gender: tpdbPerformer.gender,
      birthdate: tpdbPerformer.birthdate,
      images: tpdbPerformer.images || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.logger.info({ performerId, name: performerName }, "Created new performer");
    return performerId;
  }

  /**
   * Extract base JAV code (remove suffixes like "-001", "_001" etc)
   */
  private extractBaseJavCode(code: string): string | null {
    if (!code) return null;

    // Match common JAV code patterns: ABC-123, ABC123, etc.
    const match = code.match(/^([A-Z]+-?\d{3,})/i);
    if (match) {
      return match[1].toUpperCase().replace("-", "");
    }

    return null;
  }

  /**
   * Normalize performer name for comparison
   * - Lowercase
   * - Remove spaces and special characters
   * - Remove common suffixes/prefixes like "xxx", "official"
   */
  private normalizePerformerName(name: string): string {
    if (!name) return "";

    return name
      .toLowerCase()
      .replace(/\s+/g, "") // Remove all spaces
      .replace(/[^a-z0-9]/g, "") // Remove special characters
      .replace(/xxx|official|verified|account$/gi, "") // Remove common suffixes
      .trim();
  }
}
