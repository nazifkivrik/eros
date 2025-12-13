import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { createSubscriptionService } from "../../services/subscription.service.js";

const SubscriptionSchema = z.object({
  id: z.string(),
  entityType: z.enum(["performer", "studio", "scene"]),
  entityId: z.string(),
  qualityProfileId: z.string(),
  autoDownload: z.boolean(),
  includeMetadataMissing: z.boolean(),
  includeAliases: z.boolean(),
  status: z.string(),
  monitored: z.boolean(),
  searchCutoffDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const SubscriptionWithDetailsSchema = SubscriptionSchema.extend({
  entityName: z.string(),
  entity: z.any().nullable(), // Can be performer, studio, or scene
  qualityProfile: z.object({
    id: z.string(),
    name: z.string(),
    items: z.any(), // JSON array of quality items
    createdAt: z.string(),
    updatedAt: z.string(),
  }).nullable(),
});

const CreateSubscriptionSchema = z.object({
  entityType: z.enum(["performer", "studio", "scene"]),
  entityId: z.string(),
  qualityProfileId: z.string(),
  autoDownload: z.boolean().default(true),
  includeMetadataMissing: z.boolean().default(false),
  includeAliases: z.boolean().default(false),
});

const subscriptionsRoutes: FastifyPluginAsyncZod = async (app) => {
  const subscriptionService = createSubscriptionService(app.db);

  // Get all subscriptions
  app.get(
    "/",
    {
      schema: {
        response: {
          200: z.object({
            data: z.array(SubscriptionWithDetailsSchema),
          }),
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
        params: z.object({
          entityType: z.enum(["performer", "studio", "scene"]),
        }),
        response: {
          200: z.object({
            data: z.array(SubscriptionSchema),
          }),
        },
      },
    },
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
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: SubscriptionWithDetailsSchema,
          404: z.object({
            error: z.string(),
          }),
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
          400: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const subscription = await subscriptionService.createSubscription(
          request.body
        );
        return reply.code(201).send(subscription);
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
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          qualityProfileId: z.string().optional(),
          autoDownload: z.boolean().optional(),
          includeMetadataMissing: z.boolean().optional(),
          includeAliases: z.boolean().optional(),
          status: z.string().optional(),
          monitored: z.boolean().optional(),
        }),
        response: {
          200: SubscriptionSchema,
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
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
        params: z.object({
          id: z.string(),
        }),
        querystring: z.object({
          deleteAssociatedScenes: z.coerce.boolean().optional().default(false),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
          }),
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
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: SubscriptionSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      return await subscriptionService.toggleMonitoring(id);
    }
  );

  // Toggle status
  app.post(
    "/:id/toggle-status",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: SubscriptionSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      return await subscriptionService.toggleStatus(id);
    }
  );

  // Check subscription status by entity
  app.get(
    "/check/:entityType/:entityId",
    {
      schema: {
        params: z.object({
          entityType: z.enum(["performer", "studio", "scene"]),
          entityId: z.string(),
        }),
        response: {
          200: z.object({
            subscribed: z.boolean(),
            subscription: SubscriptionSchema.nullable(),
          }),
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
        subscription: subscription || null,
      };
    }
  );

  // Get all scenes for a performer/studio subscription with download status
  app.get(
    "/:id/scenes",
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            data: z.array(z.any()),
          }),
          404: z.object({
            error: z.string(),
          }),
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
        ? app.db.query.performersScenes.findMany({
            where: (performersScenes, { eq }) => eq(performersScenes.performerId, subscription.entityId),
            with: {
              scene: {
                with: {
                  sceneFiles: true,
                },
              },
            },
          })
        : app.db.query.studiosScenes.findMany({
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
          const downloadQueue = await app.db.query.downloadQueue.findFirst({
            where: (dq, { eq }) => eq(dq.sceneId, scene.id),
            orderBy: (dq, { desc }) => [desc(dq.addedAt)],
          });

          // Check if scene has a subscription
          const sceneSubscription = await app.db.query.subscriptions.findFirst({
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
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            files: z.array(z.any()),
            downloadQueue: z.any().nullable(),
          }),
          404: z.object({
            error: z.string(),
          }),
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
      const files = await app.db.query.sceneFiles.findMany({
        where: (sceneFiles, { eq }) => eq(sceneFiles.sceneId, subscription.entityId),
      });

      // Get download queue entry
      const downloadQueue = await app.db.query.downloadQueue.findFirst({
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
