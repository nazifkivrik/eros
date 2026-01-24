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
   */
  async linkScenePerformers(dto: LinkScenePerformersDTO): Promise<void> {
    this.logger.info({ sceneId: dto.sceneId }, "Linking scene performers");

    // Link the subscribed entity (performer) to the scene first
    if (dto.entityType === "performer") {
      await this.scenesRepository.linkPerformerToScene(dto.entityId, dto.sceneId);
      this.logger.info({ performerId: dto.entityId }, "Linked subscription performer to scene");
    }

    // Link other performers from scene metadata
    if (dto.performers && dto.performers.length > 0) {
      for (const tpdbPerformerWrapper of dto.performers) {
        // TPDB adapter wraps performer in {performer: {...}} format
        const tpdbPerformer = 'performer' in tpdbPerformerWrapper
          ? (tpdbPerformerWrapper as any).performer
          : tpdbPerformerWrapper;

        const performerId = await this.getOrCreatePerformerFromTpdb(tpdbPerformer);
        if (performerId) {
          await this.scenesRepository.linkPerformerToScene(performerId, dto.sceneId);
        }
      }
      this.logger.info(
        { count: dto.performers.length },
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
   */
  private async getOrCreatePerformerFromTpdb(tpdbPerformer: any): Promise<string | null> {
    const allPerformers = await this.db.query.performers.findMany();
    let performerRecord = allPerformers.find((p) =>
      p.externalIds.some((ext) => ext.source === "tpdb" && ext.id === tpdbPerformer.id)
    );

    if (performerRecord) {
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
}
