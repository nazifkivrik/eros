import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSubscriptionService } from "../../services/subscription.service.js";
import type { Database } from "@repo/database";
import {
  SubscriptionSchema,
  SubscriptionWithDetailsSchema,
  CreateSubscriptionSchema,
  UpdateSubscriptionSchema,
  SubscriptionParamsSchema,
  EntityTypeParamsSchema,
  CheckSubscriptionParamsSchema,
  DeleteSubscriptionQuerySchema,
  SubscriptionListResponseSchema,
  SubscriptionsByTypeResponseSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  CheckSubscriptionResponseSchema,
} from "./subscriptions.schema.js";

const subscriptionsRoutes: FastifyPluginAsyncZod = async (app) => {
  const appWithDb = app as FastifyInstance & { db: Database };
  const subscriptionService = createSubscriptionService(appWithDb.db);

  // Get all subscriptions
  app.get(
    "/",
    {
      schema: {
        response: {
          200: SubscriptionListResponseSchema,
        },
      },
    },
    async () => {
      const data = await subscriptionService.getAllSubscriptionsWithDetails();
      return { data };
    }
  );

  // Get subscriptions by type
  app.get(
    "/type/:entityType",
    {
      schema: {
        params: EntityTypeParamsSchema,
        response: {
          200: SubscriptionsByTypeResponseSchema,
        },
      },
    },
    // @ts-expect-error - Fastify type provider entityType inference
    async (request) => {
      const { entityType } = request.params;
      const data = await subscriptionService.getSubscriptionsByType(entityType);
      return { data };
    }
  );

  // Get subscription by ID
  app.get(
    "/:id",
    {
      schema: {
        params: SubscriptionParamsSchema,
        response: {
          200: SubscriptionWithDetailsSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const subscription = await subscriptionService.getSubscriptionWithDetails(id);

      if (!subscription) {
        return reply.code(404).send({ error: "Subscription not found" });
      }

      return subscription;
    }
  );

  // Create subscription
  app.post(
    "/",
    {
      schema: {
        body: CreateSubscriptionSchema,
        response: {
          201: SubscriptionSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const subscription = await subscriptionService.createSubscription(
          request.body as any
        );
        return reply.code(201).send(subscription as any);
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Update subscription
  app.patch(
    "/:id",
    {
      schema: {
        params: SubscriptionParamsSchema,
        body: UpdateSubscriptionSchema,
        response: {
          200: SubscriptionSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    // @ts-expect-error - Fastify type provider entityType inference
    async (request, reply) => {
      const { id } = request.params;

      try {
        const subscription = await subscriptionService.updateSubscription(
          id,
          request.body
        );
        return subscription;
      } catch (error) {
        return reply.code(404).send({
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Delete subscription
  app.delete(
    "/:id",
    {
      schema: {
        params: SubscriptionParamsSchema,
        querystring: DeleteSubscriptionQuerySchema,
        response: {
          200: SuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { deleteAssociatedScenes } = request.query as { deleteAssociatedScenes: boolean };
      await subscriptionService.deleteSubscription(id, deleteAssociatedScenes);
      return { success: true };
    }
  );

  // Toggle monitoring
  app.post(
    "/:id/toggle-monitoring",
    {
      schema: {
        params: SubscriptionParamsSchema,
        response: {
          200: SubscriptionSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      return (await subscriptionService.toggleMonitoring(id)) as any;
    }
  );

  // Toggle status
  app.post(
    "/:id/toggle-status",
    {
      schema: {
        params: SubscriptionParamsSchema,
        response: {
          200: SubscriptionSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      return (await subscriptionService.toggleStatus(id)) as any;
    }
  );

  // Check subscription status by entity
  app.get(
    "/check/:entityType/:entityId",
    {
      schema: {
        params: CheckSubscriptionParamsSchema,
        response: {
          200: CheckSubscriptionResponseSchema,
        },
      },
    },
    async (request) => {
      const { entityType, entityId } = request.params;
      const subscription = await subscriptionService.getSubscriptionByEntity(
        entityType,
        entityId
      );

      return {
        subscribed: !!subscription,
        subscription: (subscription || null) as any,
      };
    }
  );

  // Get all scenes for a performer/studio subscription with download status
  app.get(
    "/:id/scenes",
    {
      schema: {
        params: SubscriptionParamsSchema,
        response: {
          200: z.object({
            data: z.array(z.any()),
          }),
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Get subscription
      const subscription = await subscriptionService.getSubscriptionWithDetails(id);
      if (!subscription) {
        return reply.code(404).send({ error: "Subscription not found" });
      }

      if (subscription.entityType === "scene") {
        return reply.code(404).send({ error: "This endpoint is only for performer/studio subscriptions" });
      }

      // Get all scenes for this performer/studio
      const scenesQuery = subscription.entityType === "performer"
        ? appWithDb.db.query.performersScenes.findMany({
            where: (performersScenes, { eq }) => eq(performersScenes.performerId, subscription.entityId),
            with: {
              scene: {
                with: {
                  sceneFiles: true,
                },
              },
            },
          })
        : appWithDb.db.query.studiosScenes.findMany({
            where: (studiosScenes, { eq }) => eq(studiosScenes.studioId, subscription.entityId),
            with: {
              scene: {
                with: {
                  sceneFiles: true,
                },
              },
            },
          });

      const sceneRelations = await scenesQuery;
      const scenes = sceneRelations.map((rel: any) => rel.scene).filter(Boolean);

      // Get download queue status for each scene
      const scenesWithStatus = await Promise.all(
        scenes.map(async (scene: any) => {
          const downloadQueue = await appWithDb.db.query.downloadQueue.findFirst({
            where: (dq, { eq }) => eq(dq.sceneId, scene.id),
            orderBy: (dq, { desc }) => [desc(dq.addedAt)],
          });

          // Check if scene has a subscription
          const sceneSubscription = await appWithDb.db.query.subscriptions.findFirst({
            where: (subs, { and, eq }) => and(
              eq(subs.entityType, "scene"),
              eq(subs.entityId, scene.id)
            ),
          });

          return {
            ...scene,
            downloadStatus: downloadQueue?.status || "not_queued",
            downloadProgress: downloadQueue,
            hasFiles: scene.sceneFiles && scene.sceneFiles.length > 0,
            fileCount: scene.sceneFiles?.length || 0,
            isSubscribed: !!sceneSubscription,
            subscriptionId: sceneSubscription?.id || null,
          };
        })
      );

      return { data: scenesWithStatus };
    }
  );

  // Get files and download status for a scene subscription
  app.get(
    "/:id/files",
    {
      schema: {
        params: SubscriptionParamsSchema,
        response: {
          200: z.object({
            files: z.array(z.any()),
            downloadQueue: z.any().nullable(),
          }),
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Get subscription
      const subscription = await subscriptionService.getSubscriptionWithDetails(id);
      if (!subscription) {
        return reply.code(404).send({ error: "Subscription not found" });
      }

      if (subscription.entityType !== "scene") {
        return reply.code(404).send({ error: "This endpoint is only for scene subscriptions" });
      }

      // Get scene files
      const files = await appWithDb.db.query.sceneFiles.findMany({
        where: (sceneFiles, { eq }) => eq(sceneFiles.sceneId, subscription.entityId),
      });

      // Get download queue entry
      const downloadQueue = await appWithDb.db.query.downloadQueue.findFirst({
        where: (dq, { eq }) => eq(dq.sceneId, subscription.entityId),
        orderBy: (dq, { desc }) => [desc(dq.addedAt)],
      });

      return {
        files,
        downloadQueue: downloadQueue || null,
      };
    }
  );
};

export default subscriptionsRoutes;
