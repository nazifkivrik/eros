/**
 * Metadata Refresh Job
 * Re-queries StashDB for subscribed entities to update their metadata
 * Runs daily at 2 AM
 */

import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { subscriptions, performers, studios, scenes } from "@repo/database";

export async function metadataRefreshJob(app: FastifyInstance) {
  app.log.info("Starting metadata refresh job");

  try {
    // Get all active subscriptions
    const activeSubscriptions = await app.db.query.subscriptions.findMany({
      where: eq(subscriptions.status, "active"),
    });

    app.log.info(
      `Found ${activeSubscriptions.length} active subscriptions to refresh metadata`
    );

    // Group by entity type
    const performerIds = new Set<string>();
    const studioIds = new Set<string>();
    const sceneIds = new Set<string>();

    for (const sub of activeSubscriptions) {
      if (sub.entityType === "performer") {
        performerIds.add(sub.entityId);
      } else if (sub.entityType === "studio") {
        studioIds.add(sub.entityId);
      } else if (sub.entityType === "scene") {
        sceneIds.add(sub.entityId);
      }
    }

    // Refresh performers
    if (performerIds.size > 0) {
      app.log.info(`Refreshing metadata for ${performerIds.size} performers`);
      await refreshPerformers(app, Array.from(performerIds));
    }

    // Refresh studios
    if (studioIds.size > 0) {
      app.log.info(`Refreshing metadata for ${studioIds.size} studios`);
      await refreshStudios(app, Array.from(studioIds));
    }

    // Refresh scenes
    if (sceneIds.size > 0) {
      app.log.info(`Refreshing metadata for ${sceneIds.size} scenes`);
      await refreshScenes(app, Array.from(sceneIds));
    }

    app.log.info("Metadata refresh job completed");
  } catch (error) {
    app.log.error({ error }, "Metadata refresh job failed");
    throw error;
  }
}

async function refreshPerformers(
  app: FastifyInstance,
  performerIds: string[]
) {
  for (const id of performerIds) {
    try {
      // Get current performer data
      const performer = await app.db.query.performers.findFirst({
        where: eq(performers.id, id),
      });

      if (!performer || !performer.stashdbId) {
        app.log.warn(`Performer ${id} not found or has no StashDB ID, skipping`);
        continue;
      }

      // Fetch updated data from StashDB
      const updatedData = await app.stashdb.request(
        `query {
          findPerformer(id: "${performer.stashdbId}") {
            id
            name
            disambiguation
            gender
            birth_date
            death_date
            career_start_year
            career_end_year
            cup_size
            band_size
            waist_size
            hip_size
            tattoos {
              location
              description
            }
            piercings {
              location
              description
            }
            aliases
            images {
              url
              width
              height
            }
          }
        }`
      );

      if (!updatedData?.findPerformer) {
        app.log.warn(`No data returned from StashDB for performer ${performer.stashdbId}`);
        continue;
      }

      const p = updatedData.findPerformer;

      // Format body modifications to string
      const formatBodyMods = (mods: any[]) => {
        if (!mods || mods.length === 0) return null;
        return mods.map((m: any) => `${m.location}${m.description ? `: ${m.description}` : ''}`).join(', ');
      };

      // Format measurements
      const formatMeasurements = () => {
        const parts = [];
        if (p.cup_size || p.band_size) {
          parts.push(`${p.cup_size || ''}${p.band_size || ''}`);
        }
        if (p.waist_size) parts.push(String(p.waist_size));
        if (p.hip_size) parts.push(String(p.hip_size));
        return parts.length > 0 ? parts.join('-') : null;
      };

      // Calculate career length
      const careerLength = p.career_start_year && p.career_end_year
        ? `${p.career_end_year - p.career_start_year} years`
        : p.career_start_year
        ? `${new Date().getFullYear() - p.career_start_year}+ years`
        : null;

      // Update performer in database
      await app.db
        .update(performers)
        .set({
          name: p.name,
          aliases: p.aliases || [],
          disambiguation: p.disambiguation,
          gender: p.gender,
          birthdate: p.birth_date,
          deathDate: p.death_date,
          careerStartDate: p.career_start_year ? String(p.career_start_year) : null,
          careerEndDate: p.career_end_year ? String(p.career_end_year) : null,
          careerLength: careerLength,
          bio: null, // StashDB doesn't have bio
          measurements: formatMeasurements(),
          tattoos: formatBodyMods(p.tattoos),
          piercings: formatBodyMods(p.piercings),
          images: p.images || [],
          updatedAt: new Date().toISOString(),
        })
        .where(eq(performers.id, id));

      app.log.info(`Updated metadata for performer ${performer.name}`);
    } catch (error) {
      app.log.error(
        { error, performerId: id },
        `Failed to refresh metadata for performer ${id}`
      );
    }
  }
}

async function refreshStudios(app: FastifyInstance, studioIds: string[]) {
  for (const id of studioIds) {
    try {
      // Get current studio data
      const studio = await app.db.query.studios.findFirst({
        where: eq(studios.id, id),
      });

      if (!studio || !studio.stashdbId) {
        app.log.warn(`Studio ${id} not found or has no StashDB ID, skipping`);
        continue;
      }

      // Fetch updated data from StashDB
      const updatedData = await app.stashdb.request(
        `query {
          findStudio(id: "${studio.stashdbId}") {
            id
            name
            parent { id }
            urls { url type }
            images { url width height }
          }
        }`
      );

      if (!updatedData?.findStudio) {
        app.log.warn(`No data returned from StashDB for studio ${studio.stashdbId}`);
        continue;
      }

      const s = updatedData.findStudio;

      // Update studio in database
      await app.db
        .update(studios)
        .set({
          name: s.name,
          aliases: [], // StashDB doesn't have aliases for studios
          parentStudioId: s.parent?.id || null,
          images: s.images || [],
          url: s.urls?.[0]?.url || null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(studios.id, id));

      app.log.info(`Updated metadata for studio ${studio.name}`);
    } catch (error) {
      app.log.error(
        { error, studioId: id },
        `Failed to refresh metadata for studio ${id}`
      );
    }
  }
}

async function refreshScenes(app: FastifyInstance, sceneIds: string[]) {
  for (const id of sceneIds) {
    try {
      // Get current scene data
      const scene = await app.db.query.scenes.findFirst({
        where: eq(scenes.id, id),
      });

      if (!scene || !scene.stashdbId) {
        app.log.warn(`Scene ${id} not found or has no StashDB ID, skipping`);
        continue;
      }

      // Fetch updated data from StashDB
      const updatedData = await app.stashdb.request(
        `query {
          findScene(id: "${scene.stashdbId}") {
            id
            title
            date
            details
            duration
            director
            code
            urls { url type }
            images { url width height }
          }
        }`
      );

      if (!updatedData?.findScene) {
        app.log.warn(`No data returned from StashDB for scene ${scene.stashdbId}`);
        continue;
      }

      const sc = updatedData.findScene;

      // Update scene in database
      await app.db
        .update(scenes)
        .set({
          title: sc.title,
          date: sc.date,
          details: sc.details,
          duration: sc.duration,
          director: sc.director,
          code: sc.code,
          urls: sc.urls?.map((u: any) => u.url) || [],
          images: sc.images || [],
          updatedAt: new Date().toISOString(),
        })
        .where(eq(scenes.id, id));

      app.log.info(`Updated metadata for scene ${scene.title}`);
    } catch (error) {
      app.log.error(
        { error, sceneId: id },
        `Failed to refresh metadata for scene ${id}`
      );
    }
  }
}
