import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { SetupDataSchema, SetupStatusResponseSchema } from "./setup.schema.js";

/**
 * Setup Routes
 * Pure HTTP routing - delegates to controller
 * Clean Architecture: Route → Controller → Service → Repository
 */
const setupRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get controller from DI container
  const { setupController } = app.container;

  // Get setup status
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
      return await setupController.getStatus();
    }
  );

  // Complete setup
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
      return await setupController.completeSetup(request.body);
    }
  );
};

export default setupRoutes;
