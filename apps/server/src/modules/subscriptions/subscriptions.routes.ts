import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  ErrorResponseSchema,
  SuccessResponseSchema,
} from "@/schemas/common.schema.js";
import {
  SubscriptionSchema,
  SubscriptionDetailResponseSchema,
  CreateSubscriptionSchema,
  UpdateSubscriptionSchema,
  SubscriptionParamsSchema,
  EntityTypeParamsSchema,
  CheckSubscriptionParamsSchema,
  DeleteSubscriptionQuerySchema,
  SubscriptionListQuerySchema,
  SubscriptionListResponseSchema,
  SubscriptionsByTypeResponseSchema,
  CheckSubscriptionResponseSchema,
} from "./subscriptions.schema.js";
import {
  NotFoundError,
  BusinessLogicError,
} from "@/errors/application-errors.js";

/**
 * Subscriptions Routes
 * Pure HTTP routing - delegates to controller
 * Clean Architecture: Route → Controller → Service → Repository
 */
const subscriptionsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get controller from DI container
  const { subscriptionsController, scenesFilesService, settingsRepository } =
    app.container;

  // Get all subscriptions
  app.get(
    "/",
    {
      schema: {
        tags: ["subscriptions"],
        summary: "List subscriptions",
        description:
          "Get all subscriptions with detailed entity information (performers, studios, scenes)",
        querystring: SubscriptionListQuerySchema,
        response: {
          200: SubscriptionListResponseSchema,
        },
      },
    },
    async (request) => {
      return await subscriptionsController.list(request.query);
    }
  );

  // Get subscriptions by type
  app.get(
    "/type/:entityType",
    {
      schema: {
        tags: ["subscriptions"],
        summary: "Get subscriptions by type",
        description:
          "Filter subscriptions by entity type (performer, studio, or scene)",
        params: EntityTypeParamsSchema,
        response: {
          200: SubscriptionsByTypeResponseSchema,
        },
      },
    },
    async (request) => {
      return await subscriptionsController.getByType(request.params);
    }
  );

  // Get subscription by ID
  app.get(
    "/:id",
    {
      schema: {
        tags: ["subscriptions"],
        summary: "Get subscription details",
        description:
          "Retrieve detailed information about a specific subscription including entity details and quality profile",
        params: SubscriptionParamsSchema,
        response: {
          200: SubscriptionDetailResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const subscription = await subscriptionsController.getById(
          request.params
        );
        return subscription as z.infer<typeof SubscriptionDetailResponseSchema>;
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Create subscription
  app.post(
    "/",
    {
      schema: {
        tags: ["subscriptions"],
        summary: "Create subscription",
        description:
          "Subscribe to a performer, studio, or scene to automatically monitor and download new content",
        body: CreateSubscriptionSchema,
        response: {
          201: SubscriptionSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const subscription = await subscriptionsController.create(request.body);
        return reply.code(201).send(subscription);
      } catch (error) {
        throw error; // Custom errors will be handled by global error handler
      }
    }
  );

  // Update subscription
  app.patch(
    "/:id",
    {
      schema: {
        tags: ["subscriptions"],
        summary: "Update subscription",
        description:
          "Update subscription settings such as quality profile, monitoring status, or active status",
        params: SubscriptionParamsSchema,
        body: UpdateSubscriptionSchema,
        response: {
          200: SubscriptionSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const subscription = await subscriptionsController.update(
          request.params,
          request.body
        );
        return subscription;
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        throw error; // Custom errors will be handled by global error handler
      }
    }
  );

  // Delete subscription
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["subscriptions"],
        summary: "Delete subscription",
        description:
          "Delete a subscription and optionally remove associated scenes and their files from disk",
        params: SubscriptionParamsSchema,
        querystring: DeleteSubscriptionQuerySchema,
        response: {
          200: SuccessResponseSchema,
        },
      },
    },
    async (request) => {
      return await subscriptionsController.delete(
        request.params,
        request.query
      );
    }
  );

  // Toggle status
  app.post(
    "/:id/toggle-status",
    {
      schema: {
        tags: ["subscriptions"],
        summary: "Toggle status",
        description:
          "Activate or deactivate a subscription (inactive subscriptions are not monitored)",
        params: SubscriptionParamsSchema,
        response: {
          200: SubscriptionSchema,
        },
      },
    },
    async (request) => {
      return await subscriptionsController.toggleStatus(request.params);
    }
  );

  // Check subscription status by entity
  app.get(
    "/check/:entityType/:entityId",
    {
      schema: {
        tags: ["subscriptions"],
        summary: "Check subscription status",
        description:
          "Check if a specific entity (performer, studio, or scene) has an active subscription",
        params: CheckSubscriptionParamsSchema,
        response: {
          200: CheckSubscriptionResponseSchema,
        },
      },
    },
    async (request) => {
      return await subscriptionsController.checkSubscription(request.params);
    }
  );

  // Get all scenes for a performer/studio subscription with download status
  app.get(
    "/:id/scenes",
    {
      schema: {
        tags: ["subscriptions"],
        summary: "Get subscription scenes",
        description:
          "Get all scenes for a performer or studio subscription with download status and file information (not available for scene subscriptions)",
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
      try {
        return await subscriptionsController.getSubscriptionScenes(
          request.params
        );
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof BusinessLogicError) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Get files and download status for a scene subscription
  app.get(
    "/:id/files",
    {
      schema: {
        tags: ["subscriptions"],
        summary: "Get subscription files",
        description:
          "Get scene files, download queue status, and folder contents (NFO, posters, videos) for a scene subscription (only available for scene subscriptions)",
        params: SubscriptionParamsSchema,
        response: {
          200: z.object({
            files: z.array(z.any()),
            downloadQueue: z.any().nullable(),
            sceneFolder: z.string().nullable(),
            folderContents: z.object({
              nfoFiles: z.array(z.string()),
              posterFiles: z.array(z.string()),
              videoFiles: z.array(z.string()),
            }),
          }),
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await subscriptionsController.getSubscriptionFiles(
          request.params
        );

        // Get settings for scenes path
        const settingRecord =
          await settingsRepository.findByKey("app-settings");

        // Import DEFAULT_SETTINGS from shared-types
        const { DEFAULT_SETTINGS } = await import("@repo/shared-types");
        const settings = settingRecord
          ? (settingRecord.value as any)
          : DEFAULT_SETTINGS;

        // Get subscription and scene
        const subscription = await app.container.subscriptionsService.getById(
          request.params.id
        );

        if (!subscription) {
          throw new NotFoundError("Subscription", request.params.id);
        }

        // Use scenesRepository instead of direct DB access
        const scene = await app.container.scenesRepository.findById(
          subscription.entityId
        );

        if (!scene) {
          throw new NotFoundError("Scene", subscription.entityId);
        }

        // Generate scene folder path
        const sceneFolder = scenesFilesService.generateSceneFolderPath(
          settings.general.scenesPath,
          scene.title
        );

        // Scan scene folder using service
        let folderContents: {
          nfoFiles: string[];
          posterFiles: string[];
          videoFiles: string[];
        } = {
          nfoFiles: [],
          posterFiles: [],
          videoFiles: [],
        };

        if (sceneFolder) {
          folderContents =
            await scenesFilesService.scanSceneFolder(sceneFolder);
        }

        return {
          ...result,
          sceneFolder,
          folderContents,
        };
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof BusinessLogicError) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );
};

export default subscriptionsRoutes;
