import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { getJobProgressService } from "../../services/job-progress.service.js";
import {
  JobNameParamsSchema,
  JobsListResponseSchema,
  TriggerJobResponseSchema,
  ErrorResponseSchema,
} from "./jobs.schema.js";

const jobsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get all jobs
  app.get(
    "/",
    {
      schema: {
        response: {
          200: JobsListResponseSchema,
        },
      },
    },
    async () => {
      const jobs = await app.scheduler.getJobs();
      return { jobs };
    }
  );

  // Get job history
  app.get(
    "/history",
    {
      schema: {
        response: {
          200: JobsListResponseSchema,
        },
      },
    },
    async (request) => {
      const { limit } = request.query as { limit?: number };
      const history = await app.scheduler.getJobHistory(limit || 50);
      return { jobs: history };
    }
  );

  // Trigger a job manually
  app.post(
    "/:jobName/trigger",
    {
      schema: {
        params: JobNameParamsSchema,
        response: {
          200: TriggerJobResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { jobName } = request.params;

      try {
        await app.scheduler.triggerJob(jobName);
        return {
          success: true,
          message: `Job ${jobName} triggered successfully`,
        };
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
        response: {
          // SSE doesn't use standard JSON response
        },
      },
    },
    async (request, reply) => {
      const progressService = getJobProgressService();

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      // Send initial connection message
      reply.raw.write(`data: ${JSON.stringify({ type: "connected", message: "Job progress stream connected" })}\n\n`);

      // Handler for job progress events
      const progressHandler = (event: any) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      // Subscribe to job progress events
      progressService.on("job-progress", progressHandler);

      // Clean up on connection close
      request.raw.on("close", () => {
        progressService.off("job-progress", progressHandler);
        reply.raw.end();
      });

      // Keep connection alive with periodic heartbeat
      const heartbeat = setInterval(() => {
        reply.raw.write(`: heartbeat\n\n`);
      }, 30000); // Every 30 seconds

      request.raw.on("close", () => {
        clearInterval(heartbeat);
      });
    }
  );
};

export default jobsRoutes;
