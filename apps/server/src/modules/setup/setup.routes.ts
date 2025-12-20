import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { SetupService } from "./setup.service.js";
import { SetupDataSchema, SetupStatusResponseSchema } from "./setup.schema.js";

const setupRoutes: FastifyPluginAsyncZod = async (app) => {
  const setupService = new SetupService(app.db);

  // Get setup status
  app.get(
    "/status",
    {
      schema: {
        response: {
          200: SetupStatusResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const status = await setupService.getSetupStatus();
      return reply.code(200).send(status);
    }
  );

  // Complete setup
  app.post(
    "/",
    {
      schema: {
        body: SetupDataSchema,
        response: {
          200: SetupStatusResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await setupService.completeSetup(request.body);
      const status = await setupService.getSetupStatus();
      return reply.code(200).send(status);
    }
  );
};

export default setupRoutes;
