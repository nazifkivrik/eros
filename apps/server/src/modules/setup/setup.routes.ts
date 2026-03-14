import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { SetupDataSchema, SetupStatusResponseSchema } from "./setup.schema.js";

// Cache setup status permanently - once setup is completed, it never changes
// This eliminates unnecessary database queries after setup
let cachedStatus: { setupCompleted: boolean; hasAdmin: boolean } | null = null;

/**
 * Setup Routes
 * Pure HTTP routing - delegates to controller
 * Clean Architecture: Route → Controller → Service → Repository
 */
const setupRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get controller from DI container
  const { setupController } = app.container;

  // Get setup status (with permanent caching after setup completes)
  app.get(
    "/status",
    {
      schema: {
        tags: ["setup"],
        summary: "Get setup status",
        description: "Check if initial setup has been completed",
        response: {
          200: SetupStatusResponseSchema,
        },
      },
    },
    async () => {
      // If setup is already completed, return cached result immediately
      // Once setup is done, it will never change back to not completed
      if (cachedStatus?.setupCompleted) {
        return cachedStatus;
      }

      // Setup not completed yet (or first check), fetch from controller
      const data = await setupController.getStatus();

      // Cache the result permanently
      cachedStatus = data;

      return data;
    }
  );

  // Complete setup (updates cache after completion)
  app.post(
    "/",
    {
      schema: {
        tags: ["setup"],
        summary: "Complete initial setup",
        description: "Perform initial application setup with admin user credentials",
        body: SetupDataSchema,
        response: {
          200: SetupStatusResponseSchema,
        },
      },
    },
    async (request) => {
      const result = await setupController.completeSetup(request.body);

      // Update cache to reflect completed setup
      // This cache will now be permanent since setup never reverts
      cachedStatus = result;

      return result;
    }
  );
};

/**
 * Get cached setup status (useful for other parts of the app)
 */
export function getCachedSetupStatus() {
  return cachedStatus;
}

export default setupRoutes;
