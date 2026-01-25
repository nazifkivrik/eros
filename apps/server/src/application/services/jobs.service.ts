import type { Logger } from "pino";
import type { JobProgressService } from "@/infrastructure/job-progress.service.js";

/**
 * Jobs Service Interface
 * Represents the scheduler plugin's job management capabilities
 */
export interface SchedulerService {
  getJobs(): Promise<any[]>;
  getJobHistory(limit?: number): Promise<any[]>;
  triggerJob(jobName: string): Promise<void>;
}

/**
 * Jobs Service
 * Business logic for managing background jobs
 * Responsibilities:
 * - Delegate to SchedulerService for job management
 * - Access job progress service for SSE events
 * - No database interaction (jobs are managed by SchedulerService)
 */
export class JobsService {
  private schedulerService: SchedulerService | undefined;
  private jobProgressService: JobProgressService;
  private logger: Logger;

  constructor({
    schedulerService,
    jobProgressService,
    logger,
  }: {
    schedulerService?: SchedulerService;
    jobProgressService: JobProgressService;
    logger: Logger;
  }) {
    this.schedulerService = schedulerService;
    this.jobProgressService = jobProgressService;
    this.logger = logger;
  }

  /**
   * Set scheduler service after container initialization
   * This is called by the container plugin to avoid circular dependency
   */
  setSchedulerService(schedulerService: SchedulerService): void {
    this.schedulerService = schedulerService;
  }

  /**
   * Ensure scheduler is available
   */
  private ensureSchedulerAvailable(): void {
    if (!this.schedulerService) {
      throw new Error("Scheduler not configured");
    }
  }

  /**
   * Get all jobs with their status and schedule information
   */
  async getAllJobs() {
    this.ensureSchedulerAvailable();
    return await this.schedulerService!.getJobs();
  }

  /**
   * Get job execution history
   */
  async getJobHistory(limit?: number) {
    this.ensureSchedulerAvailable();
    return await this.schedulerService!.getJobHistory(limit || 50);
  }

  /**
   * Manually trigger a job
   * Returns immediately without waiting for job completion
   */
  async triggerJob(jobName: string): Promise<void> {
    this.ensureSchedulerAvailable();

    try {
      // Trigger job without waiting for completion to avoid timeout
      // Job runs in background, errors are logged but don't affect response
      this.schedulerService!.triggerJob(jobName).catch(error => {
        this.logger.error({ error, jobName }, "Job execution failed");
      });
      this.logger.info({ jobName }, "Job triggered successfully");
    } catch (error) {
      this.logger.error({ error, jobName }, "Failed to trigger job");
      throw error;
    }
  }

  /**
   * Get job progress service for SSE
   * This is used by the controller to set up SSE connections
   */
  getJobProgressService(): JobProgressService {
    return this.jobProgressService;
  }
}
