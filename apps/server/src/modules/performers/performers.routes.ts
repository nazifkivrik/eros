import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { performers } from "@repo/database";
import { nanoid } from "nanoid";

const ImageSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const PerformerResponseSchema = z.object({
  id: z.string(),
  stashdbId: z.string().nullable(),
  name: z.string(),
  aliases: z.array(z.string()),
  disambiguation: z.string().nullable(),
  gender: z.string().nullable(),
  birthdate: z.string().nullable(),
  deathDate: z.string().nullable(),
  careerStartDate: z.string().nullable(),
  careerEndDate: z.string().nullable(),
  images: z.array(ImageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const performersRoutes: FastifyPluginAsyncZod = async (app) => {
  // List performers
  app.get(
    "/",
    {
      schema: {
        querystring: z.object({
          limit: z.coerce.number().min(1).max(100).default(20),
          offset: z.coerce.number().min(0).default(0),
        }),
        response: {
          200: z.object({
            data: z.array(PerformerResponseSchema),
            total: z.number(),
          }),
        },
      },
    },
    async (request) => {
      const { limit, offset } = request.query;

      const data = await app.db.query.performers.findMany({
        limit,
        offset,
      });

      // Get total count
      const totalResult = await app.db
        .select({ count: performers.id })
        .from(performers);

      return {
        data,
        total: totalResult.length,
      };
    }
  );

  // Get performer by ID
  app.get(
    "/:id",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: PerformerResponseSchema,
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const performer = await app.db.query.performers.findFirst({
        where: eq(performers.id, id),
      });

      if (!performer) {
        return reply.code(404).send({ error: "Performer not found" });
      }

      return performer;
    }
  );

  // Create performer
  app.post(
    "/",
    {
      schema: {
        body: z.object({
          stashdbId: z.string().optional(),
          name: z.string(),
          aliases: z.array(z.string()).default([]),
          disambiguation: z.string().optional(),
          gender: z.string().optional(),
          birthdate: z.string().optional(),
          deathDate: z.string().optional(),
          careerStartDate: z.string().optional(),
          careerEndDate: z.string().optional(),
          images: z.array(ImageSchema).default([]),
        }),
        response: {
          201: PerformerResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const data = request.body;

      const id = nanoid();
      const now = new Date().toISOString();

      const newPerformer = {
        id,
        stashdbId: data.stashdbId || null,
        name: data.name,
        aliases: data.aliases,
        disambiguation: data.disambiguation || null,
        gender: data.gender || null,
        birthdate: data.birthdate || null,
        deathDate: data.deathDate || null,
        careerStartDate: data.careerStartDate || null,
        careerEndDate: data.careerEndDate || null,
        images: data.images,
        createdAt: now,
        updatedAt: now,
      };

      await app.db.insert(performers).values(newPerformer);

      return reply.code(201).send(newPerformer);
    }
  );

  // Update performer
  app.patch(
    "/:id",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          name: z.string().optional(),
          aliases: z.array(z.string()).optional(),
          disambiguation: z.string().optional(),
          gender: z.string().optional(),
          birthdate: z.string().optional(),
          deathDate: z.string().optional(),
          careerStartDate: z.string().optional(),
          careerEndDate: z.string().optional(),
          images: z.array(ImageSchema).optional(),
        }),
        response: {
          200: PerformerResponseSchema,
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const existing = await app.db.query.performers.findFirst({
        where: eq(performers.id, id),
      });

      if (!existing) {
        return reply.code(404).send({ error: "Performer not found" });
      }

      const now = new Date().toISOString();

      await app.db
        .update(performers)
        .set({
          ...updates,
          updatedAt: now,
        })
        .where(eq(performers.id, id));

      const updated = await app.db.query.performers.findFirst({
        where: eq(performers.id, id),
      });

      return updated!;
    }
  );

  // Delete performer
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

      const existing = await app.db.query.performers.findFirst({
        where: eq(performers.id, id),
      });

      if (!existing) {
        return reply.code(404).send({ error: "Performer not found" });
      }

      await app.db.delete(performers).where(eq(performers.id, id));

      return { success: true };
    }
  );
};

export default performersRoutes;
