import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { getJobProgressService } from "../../services/job-progress.service.js";

const JobNameSchema = z.enum([
  "subscription-search",
  "metadata-refresh",
  "torrent-monitor",
  "cleanup",
  "metadata-discovery",
]);

const JobSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
});

const jobsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Get all jobs
  app.get(
    "/",
    {
      schema: {
        response: {
          200: z.object({
            jobs: z.array(JobSchema),
          }),
        },
      },
    },
    async () => {
      const jobs = app.scheduler.getJobs();
      return { jobs };
    }
  );

  // Trigger a job manually
  app.post(
    "/:jobName/trigger",
    {
      schema: {
        params: z.object({
          jobName: JobNameSchema,
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          400: z.object({
            error: z.string(),
          }),
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
