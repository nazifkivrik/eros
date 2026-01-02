import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { performers } from "@repo/database";
import { nanoid } from "nanoid";
import {
  PerformerResponseSchema,
  PerformerParamsSchema,
  PerformerListQuerySchema,
  CreatePerformerSchema,
  UpdatePerformerSchema,
  PerformerListResponseSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
} from "./performers.schema.js";

const performersRoutes: FastifyPluginAsyncZod = async (app) => {
  // List performers
  app.get(
    "/",
    {
      schema: {
        querystring: PerformerListQuerySchema,
        response: {
          200: PerformerListResponseSchema,
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
        params: PerformerParamsSchema,
        response: {
          200: PerformerResponseSchema,
          404: ErrorResponseSchema,
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
        body: CreatePerformerSchema,
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
        tpdbId: data.tpdbId || null,
        slug: data.name.toLowerCase().replace(/\s+/g, "-"),
        name: data.name,
        fullName: data.name,
        rating: 0,
        aliases: data.aliases,
        disambiguation: data.disambiguation || null,
        gender: data.gender || null,
        birthdate: data.birthdate || null,
        deathDate: data.deathDate || null,
        images: data.images,
        fakeBoobs: false,
        sameSexOnly: false,
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
        params: PerformerParamsSchema,
        body: UpdatePerformerSchema,
        response: {
          200: PerformerResponseSchema,
          404: ErrorResponseSchema,
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
        params: PerformerParamsSchema,
        querystring: z.object({
          deleteAssociatedScenes: z.boolean().optional().default(false),
          removeFiles: z.boolean().optional().default(false),
        }),
        response: {
          200: SuccessResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { deleteAssociatedScenes, removeFiles } = request.query;

      const existing = await app.db.query.performers.findFirst({
        where: eq(performers.id, id),
      });

      if (!existing) {
        return reply.code(404).send({ error: "Performer not found" });
      }

      // Check if performer has a subscription
      const subscription = await app.db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.entityType, "performer"),
          eq(subscriptions.entityId, id)
        ),
      });

      // If subscription exists, delete it using subscription service
      // This will handle scene deletion, download queue cleanup, and torrent removal
      if (subscription) {
        const { createSettingsService } = await import("../../services/settings.service.js");
        const { createSubscriptionService } = await import("../../services/subscription.service.js");
        const settingsService = createSettingsService(app.db);
        const settings = await settingsService.getSettings();

        const tpdbService = settings.tpdb.enabled ? app.tpdb : undefined;
        const subscriptionService = createSubscriptionService(app.db, tpdbService);

        await subscriptionService.deleteSubscription(subscription.id, deleteAssociatedScenes, removeFiles);
        app.log.info({ performerId: id, subscriptionId: subscription.id }, "Deleted performer subscription");
      }

      // Delete performer (cascade deletes will handle performersScenes junction table)
      await app.db.delete(performers).where(eq(performers.id, id));

      return { success: true };
    }
  );
};

export default performersRoutes;
