import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { qualityProfiles } from "@repo/database";
import { nanoid } from "nanoid";

const QualityItemSchema = z.object({
  quality: z.enum([
    "2160p",
    "1080p",
    "720p",
    "480p",
    "any", // any quality
  ]),
  source: z.enum([
    "bluray",
    "webdl",
    "webrip",
    "hdtv",
    "dvd",
    "any", // any source
  ]),
  minSeeders: z.union([z.number().min(0), z.literal("any")]).default(0), // can be "any" or a number
  maxSize: z.number().min(0).default(0), // in GB, 0 means unlimited
});

const QualityProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  items: z.array(QualityItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const qualityProfilesRoutes: FastifyPluginAsyncZod = async (app) => {
  // List quality profiles
  app.get(
    "/",
    {
      schema: {
        response: {
          200: z.object({
            data: z.array(QualityProfileResponseSchema),
          }),
        },
      },
    },
    async () => {
      const data = await app.db.query.qualityProfiles.findMany();
      return { data: data as unknown as Array<z.infer<typeof QualityProfileResponseSchema>> };
    }
  );

  // Get quality profile by ID
  app.get(
    "/:id",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: QualityProfileResponseSchema,
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const profile = await app.db.query.qualityProfiles.findFirst({
        where: eq(qualityProfiles.id, id),
      });

      if (!profile) {
        return reply.code(404).send({ error: "Quality profile not found" });
      }

      return profile as unknown as z.infer<typeof QualityProfileResponseSchema>;
    }
  );

  // Create quality profile
  app.post(
    "/",
    {
      schema: {
        body: z.object({
          name: z.string().min(1),
          items: z.array(QualityItemSchema).min(1),
        }),
        response: {
          201: QualityProfileResponseSchema,
          400: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, items } = request.body;

      // Define quality order (best to worst)
      const qualityOrder = ["2160p", "1080p", "720p", "480p", "any"];
      const sourceOrder = ["bluray", "webdl", "webrip", "hdtv", "dvd", "any"];

      // Auto-sort items from best to worst
      const sortedItems = [...items].sort((a, b) => {
        const qualityDiff = qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality);
        if (qualityDiff !== 0) return qualityDiff;
        
        // If quality is same, sort by source
        return sourceOrder.indexOf(a.source) - sourceOrder.indexOf(b.source);
      });

      const id = nanoid();
      const now = new Date().toISOString();

      const newProfile = {
        id,
        name,
        items: sortedItems,
        createdAt: now,
        updatedAt: now,
      };

      await app.db.insert(qualityProfiles).values(newProfile as any);

      return reply.code(201).send(newProfile);
    }
  );

  // Update quality profile
  app.put(
    "/:id",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          name: z.string().min(1),
          items: z.array(QualityItemSchema).min(1),
        }),
        response: {
          200: QualityProfileResponseSchema,
          400: z.object({
            error: z.string(),
          }),
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name, items } = request.body;

      const existing = await app.db.query.qualityProfiles.findFirst({
        where: eq(qualityProfiles.id, id),
      });

      if (!existing) {
        return reply.code(404).send({ error: "Quality profile not found" });
      }

      // Define quality order (best to worst)
      const qualityOrder = ["2160p", "1080p", "720p", "480p", "any"];
      const sourceOrder = ["bluray", "webdl", "webrip", "hdtv", "dvd", "any"];

      // Auto-sort items from best to worst
      const sortedItems = [...items].sort((a, b) => {
        const qualityDiff = qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality);
        if (qualityDiff !== 0) return qualityDiff;
        
        // If quality is same, sort by source
        return sourceOrder.indexOf(a.source) - sourceOrder.indexOf(b.source);
      });

      const now = new Date().toISOString();

      await app.db
        .update(qualityProfiles)
        .set({
          name,
          items: sortedItems as any,
          updatedAt: now,
        })
        .where(eq(qualityProfiles.id, id));

      const updated = await app.db.query.qualityProfiles.findFirst({
        where: eq(qualityProfiles.id, id),
      });

      return updated as unknown as z.infer<typeof QualityProfileResponseSchema>;
    }
  );

  // Delete quality profile
  app.delete(
    "/:id",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
          }),
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await app.db.query.qualityProfiles.findFirst({
        where: eq(qualityProfiles.id, id),
      });

      if (!existing) {
        return reply.code(404).send({ error: "Quality profile not found" });
      }

      await app.db.delete(qualityProfiles).where(eq(qualityProfiles.id, id));

      return { success: true };
    }
  );
};

export default qualityProfilesRoutes;
