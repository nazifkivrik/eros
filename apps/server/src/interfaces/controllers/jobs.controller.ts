import type { Logger } from "pino";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { JobProgressEvent } from "@repo/shared-types";
import { JobsService } from "@/application/services/jobs.service.js";

/**
 * Jobs Controller
 * Handles HTTP request/response for jobs endpoints
 * Responsibilities:
 * - Request validation
 * - Calling service methods
 * - Error handling
 * - SSE (Server-Sent Events) setup for job progress
 */
export class JobsController {
  private jobsService: JobsService;
  private logger: Logger;

  constructor({
    jobsService,
    logger,
  }: {
    jobsService: JobsService;
    logger: Logger;
  }) {
    this.jobsService = jobsService;
    this.logger = logger;
  }

  /**
   * Get all jobs
   */
  async getAllJobs() {
    const jobs = await this.jobsService.getAllJobs();
    return { jobs };
  }

  /**
   * Get job execution history
   */
  async getJobHistory(query: { limit?: number }) {
    const history = await this.jobsService.getJobHistory(query.limit);
    return { jobs: history };
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(params: { jobName: string }) {
    try {
      await this.jobsService.triggerJob(params.jobName);
      return {
        success: true,
        message: `Job ${params.jobName} triggered successfully`,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to trigger job"
      );
    }
  }

  /**
   * Set up SSE (Server-Sent Events) for job progress
   * This is an HTTP concern and must stay in the controller
   */
  async setupJobProgressSSE(request: FastifyRequest, reply: FastifyReply) {
    const progressService = this.jobsService.getJobProgressService();

    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial connection message
    reply.raw.write(
      `data: ${JSON.stringify({ type: "connected", message: "Job progress stream connected" })}\n\n`
    );

    // Handler for job progress events
    const progressHandler = (event: JobProgressEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Subscribe to job progress events
    progressService.on("job-progress", progressHandler);

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      reply.raw.write(`: heartbeat\n\n`);
    }, 30000); // Every 30 seconds

    // Clean up on connection close
    request.raw.on("close", () => {
      progressService.off("job-progress", progressHandler);
      clearInterval(heartbeat);
      reply.raw.end();
    });
  }
}
