/**
 * Entity Resolution Service
 * Eliminates code duplication in entity lookup and creation
 */

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Database } from "@repo/database";
import { performers, studios, scenes } from "@repo/database";
import type { MetadataProviderRegistry } from "@/infrastructure/registries/provider-registry.js";
import { logger } from "@/utils/logger.js";

export class EntityResolverService {
  private db: Database;
  private metadataRegistry: MetadataProviderRegistry;

  constructor({ db, metadataRegistry }: { db: Database; metadataRegistry: MetadataProviderRegistry }) {
    this.db = db;
    this.metadataRegistry = metadataRegistry;
  }

  /**
   * Get the primary metadata provider
   */
  private getMetadataProvider() {
    return this.metadataRegistry.getPrimary()?.provider;
  }

  /**
   * Resolve performer entity ID
   * Checks local DB, external IDs, then fetches from metadata provider if needed
   */
  async resolvePerformer(entityId: string): Promise<string | null> {
    // Check local DB first by local ID
    let performer = await this.db.query.performers.findFirst({
      where: eq(performers.id, entityId),
    });

    // If not found by local ID, try by external ID (TPDB/StashDB)
    if (!performer) {
      const allPerformers = await this.db.query.performers.findMany();
      performer = allPerformers.find((p) =>
        p.externalIds.some((ext) => ext.source === "tpdb" && ext.id === entityId)
      );
    }

    // If still not found and metadata provider is available, try fetching from it
    const metadataProvider = this.getMetadataProvider();
    if (!performer && metadataProvider) {
      try {
        logger.info(
          `[EntityResolver] Performer ${entityId} not found locally, fetching from metadata provider`
        );
        const externalPerformer = await metadataProvider.getPerformerById(entityId);

        if (externalPerformer) {
          // Check once more if performer was created in the meantime (race condition)
          const allPerformers = await this.db.query.performers.findMany();
          performer = allPerformers.find((p) =>
            p.externalIds.some(
              (ext) => ext.source === "tpdb" && ext.id === externalPerformer.id
            )
          );

          if (!performer) {
            // Create performer in local DB
            const localId = nanoid();
            // Generate slug from name
            const slug = externalPerformer.name
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .trim();

            await this.db.insert(performers).values({
              id: localId,
              externalIds: [{ source: "tpdb", id: externalPerformer.id }],
              slug,
              name: externalPerformer.name,
              fullName: externalPerformer.name,
              rating: 0,
              aliases: externalPerformer.aliases || [],
              disambiguation: externalPerformer.disambiguation,
              gender: externalPerformer.gender,
              birthdate: externalPerformer.birthDate,
              deathDate: externalPerformer.deathDate,
              careerStartYear: externalPerformer.careerStartYear,
              careerEndYear: externalPerformer.careerEndYear,
              bio: externalPerformer.bio,
              measurements: externalPerformer.measurements,
              tattoos: externalPerformer.tattoos,
              piercings: externalPerformer.piercings,
              fakeBoobs: externalPerformer.fakeBoobs || false,
              sameSexOnly: externalPerformer.sameSexOnly || false,
              images: externalPerformer.images || [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            logger.info(
              `[EntityResolver] Created performer ${externalPerformer.name} with ID ${localId}`
            );
            return localId;
          }
        }
      } catch (error) {
        logger.error({ error }, `[EntityResolver] Failed to fetch performer from metadata provider`);
      }
    }

    return performer?.id || null;
  }

  /**
   * Resolve studio entity ID
   * Checks local DB, external IDs, then fetches from metadata provider if needed
   */
  async resolveStudio(entityId: string): Promise<string | null> {
    // Check local DB first by local ID
    let studio = await this.db.query.studios.findFirst({
      where: eq(studios.id, entityId),
    });

    // If not found by local ID, try by external ID (TPDB/StashDB)
    if (!studio) {
      const allStudios = await this.db.query.studios.findMany();
      studio = allStudios.find((s) =>
        s.externalIds.some((ext) => ext.source === "tpdb" && ext.id === entityId)
      );
    }

    // If still not found and metadata provider is available, try fetching from it
    const metadataProvider = this.getMetadataProvider();
    if (!studio && metadataProvider) {
      try {
        logger.info(
          `[EntityResolver] Studio ${entityId} not found locally, fetching from metadata provider`
        );
        const externalStudio = await metadataProvider.getStudioById(entityId);

        if (externalStudio) {
          // Check once more if studio was created in the meantime (race condition)
          const allStudios = await this.db.query.studios.findMany();
          studio = allStudios.find((s) =>
            s.externalIds.some(
              (ext) => ext.source === "tpdb" && ext.id === externalStudio.id
            )
          );

          if (!studio) {
            // Create studio in local DB
            const localId = nanoid();
            // Generate slug from name
            const slug = externalStudio.name
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .trim();

            await this.db.insert(studios).values({
              id: localId,
              externalIds: [{ source: "tpdb", id: externalStudio.id }],
              name: externalStudio.name,
              slug,
              rating: 0,
              parentStudioId: externalStudio.parent?.id || null,
              url: externalStudio.urls[0]?.url || null,
              images: externalStudio.images || [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            logger.info(
              `[EntityResolver] Created studio ${externalStudio.name} with ID ${localId}`
            );
            return localId;
          }
        }
      } catch (error) {
        logger.error({ error }, `[EntityResolver] Failed to fetch studio from metadata provider`);
      }
    }

    return studio?.id || null;
  }

  /**
   * Resolve scene entity ID
   * Simple lookup - scenes are not fetched from metadata provider individually
   */
  async resolveScene(entityId: string): Promise<string | null> {
    const scene = await this.db.query.scenes.findFirst({
      where: eq(scenes.id, entityId),
    });
    return scene?.id || null;
  }

  /**
   * Generic entity resolution
   * Routes to specific resolver based on entity type
   */
  async resolveEntity(
    entityType: "performer" | "studio" | "scene",
    entityId: string
  ): Promise<string | null> {
    switch (entityType) {
      case "performer":
        return this.resolvePerformer(entityId);
      case "studio":
        return this.resolveStudio(entityId);
      case "scene":
        return this.resolveScene(entityId);
      default:
        return null;
    }
  }
}

/**
 * Factory function to create EntityResolverService
 */
export function createEntityResolverService(
  db: Database,
  metadataRegistry: MetadataProviderRegistry
): EntityResolverService {
  return new EntityResolverService({ db, metadataRegistry });
}
