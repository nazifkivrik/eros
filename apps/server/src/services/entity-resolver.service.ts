/**
 * Entity Resolution Service
 * Eliminates code duplication in entity lookup and creation
 */

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Database } from "@repo/database";
import { performers, studios, scenes } from "@repo/database";
import type { TPDBService } from "./tpdb/tpdb.service";
import { logger } from "../utils/logger.js";

export class EntityResolverService {
  private db: Database;
  private tpdb?: TPDBService;

  constructor({ db, tpdb }: { db: Database; tpdb?: TPDBService }) {
    this.db = db;
    this.tpdb = tpdb;
  }

  /**
   * Resolve performer entity ID
   * Checks local DB, external IDs, then fetches from TPDB if needed
   */
  async resolvePerformer(entityId: string): Promise<string | null> {
    // Check local DB first by local ID
    let performer = await this.db.query.performers.findFirst({
      where: eq(performers.id, entityId),
    });

    // If not found by local ID, try by external ID (TPDB)
    if (!performer) {
      const allPerformers = await this.db.query.performers.findMany();
      performer = allPerformers.find((p) =>
        p.externalIds.some((ext) => ext.source === "tpdb" && ext.id === entityId)
      );
    }

    // If still not found and TPDB is available, try fetching from TPDB
    if (!performer && this.tpdb) {
      try {
        logger.info(
          `[EntityResolver] Performer ${entityId} not found locally, fetching from TPDB`
        );
        const tpdbPerformer = await this.tpdb.getPerformerById(entityId);

        if (tpdbPerformer) {
          // Check once more if performer was created in the meantime (race condition)
          const allPerformers = await this.db.query.performers.findMany();
          performer = allPerformers.find((p) =>
            p.externalIds.some(
              (ext) => ext.source === "tpdb" && ext.id === tpdbPerformer.id
            )
          );

          if (!performer) {
            // Create performer in local DB
            const localId = nanoid();
            await this.db.insert(performers).values({
              id: localId,
              externalIds: [{ source: "tpdb", id: tpdbPerformer.id }],
              slug: tpdbPerformer.slug,
              name: tpdbPerformer.name,
              fullName: tpdbPerformer.fullName || tpdbPerformer.name,
              rating: tpdbPerformer.rating || 0,
              aliases: tpdbPerformer.aliases || [],
              disambiguation: tpdbPerformer.disambiguation,
              gender: tpdbPerformer.gender,
              birthdate: tpdbPerformer.birthdate,
              deathDate: tpdbPerformer.deathDate,
              careerStartYear: tpdbPerformer.careerStartYear,
              careerEndYear: tpdbPerformer.careerEndYear,
              bio: tpdbPerformer.bio,
              measurements: tpdbPerformer.measurements,
              tattoos: tpdbPerformer.tattoos,
              piercings: tpdbPerformer.piercings,
              fakeBoobs: tpdbPerformer.fakeBoobs || false,
              sameSexOnly: tpdbPerformer.sameSexOnly || false,
              images: tpdbPerformer.images,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            logger.info(
              `[EntityResolver] Created performer ${tpdbPerformer.name} with ID ${localId}`
            );
            return localId;
          }
        }
      } catch (error) {
        logger.error({ error }, `[EntityResolver] Failed to fetch performer from TPDB`);
      }
    }

    return performer?.id || null;
  }

  /**
   * Resolve studio entity ID
   * Checks local DB, external IDs, then fetches from TPDB if needed
   */
  async resolveStudio(entityId: string): Promise<string | null> {
    // Check local DB first by local ID
    let studio = await this.db.query.studios.findFirst({
      where: eq(studios.id, entityId),
    });

    // If not found by local ID, try by external ID (TPDB)
    if (!studio) {
      const allStudios = await this.db.query.studios.findMany();
      studio = allStudios.find((s) =>
        s.externalIds.some((ext) => ext.source === "tpdb" && ext.id === entityId)
      );
    }

    // If still not found and TPDB is available, try fetching from TPDB
    if (!studio && this.tpdb) {
      try {
        logger.info(
          `[EntityResolver] Studio ${entityId} not found locally, fetching from TPDB`
        );
        const tpdbSite = await this.tpdb.getSiteById(entityId);

        if (tpdbSite) {
          // Check once more if studio was created in the meantime (race condition)
          const allStudios = await this.db.query.studios.findMany();
          studio = allStudios.find((s) =>
            s.externalIds.some(
              (ext) => ext.source === "tpdb" && ext.id === tpdbSite.id
            )
          );

          if (!studio) {
            // Create studio in local DB
            const localId = nanoid();
            await this.db.insert(studios).values({
              id: localId,
              externalIds: [{ source: "tpdb", id: tpdbSite.id }],
              name: tpdbSite.name,
              slug: tpdbSite.slug || tpdbSite.name.toLowerCase().replace(/\s+/g, "-"),
              rating: tpdbSite.rating || 0,
              parentStudioId: tpdbSite.parentStudioId,
              url: tpdbSite.url,
              images: tpdbSite.images,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            logger.info(
              `[EntityResolver] Created studio ${tpdbSite.name} with ID ${localId}`
            );
            return localId;
          }
        }
      } catch (error) {
        logger.error({ error }, `[EntityResolver] Failed to fetch studio from TPDB`);
      }
    }

    return studio?.id || null;
  }

  /**
   * Resolve scene entity ID
   * Simple lookup - scenes are not fetched from TPDB individually
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
  tpdb?: TPDBService
): EntityResolverService {
  return new EntityResolverService({ db, tpdb });
}
