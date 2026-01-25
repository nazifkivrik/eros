import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ErrorResponseSchema } from "@/schemas/common.schema.js";
import {
  JobNameParamsSchema,
  JobsListResponseSchema,
  JobHistoryListResponseSchema,
  TriggerJobResponseSchema,
} from "./jobs.schema.js";

/**
 * Jobs Routes
 * Pure HTTP routing - delegates to controller
 * Clean Architecture: Route → Controller → Service → Scheduler Plugin
 */
const jobsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get controller from DI container
  const { jobsController } = app.container;
  // Get all jobs
  app.get(
    "/",
    {
      schema: {
        tags: ["jobs"],
        summary: "Get all jobs",
        description: "Retrieve status and schedule information for all background jobs",
        response: {
          200: JobsListResponseSchema,
        },
      },
    },
    async () => {
      return await jobsController.getAllJobs();
    }
  );

  // Get job history
  app.get(
    "/history",
    {
      schema: {
        tags: ["jobs"],
        summary: "Get job execution history",
        description: "Retrieve history of job executions with optional limit",
        response: {
          200: JobHistoryListResponseSchema,
        },
      },
    },
    async (request) => {
      const { limit } = request.query as { limit?: number };
      return await jobsController.getJobHistory({ limit });
    }
  );

  // Trigger a job manually
  app.post(
    "/:jobName/trigger",
    {
      schema: {
        tags: ["jobs"],
        summary: "Trigger a job manually",
        description: "Manually trigger execution of a background job",
        params: JobNameParamsSchema,
        response: {
          200: TriggerJobResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await jobsController.triggerJob(request.params);
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // SSE endpoint for job progress
  app.get(
    "/progress",
    {
      schema: {
        tags: ["jobs"],
        summary: "Job progress stream (SSE)",
        description: "Server-Sent Events stream for real-time job progress updates",
        response: {
          // SSE doesn't use standard JSON response
        },
      },
    },
    async (request, reply) => {
      await jobsController.setupJobProgressSSE(request, reply);
    }
  );
};

export default jobsRoutes;
