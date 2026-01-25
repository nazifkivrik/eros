/**
 * Scheduler Service
 * Manages background jobs using node-cron
 * Framework-agnostic - uses dependency injection
 */

import cron from "node-cron";
import * as cronParser from "cron-parser";
import { jobsLog } from "@repo/database";
import { desc, eq } from "drizzle-orm";
import type { Database } from "@repo/database";
import type { Logger } from "pino";
import type { ServiceContainer } from "../../container/types.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { jobsLog as JobsLogTable } from "@repo/database/schema";

interface JobDefinition {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  enabled: boolean;
}

interface JobStatus {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  status: string;
  lastRun: string | null;
  completedAt: string | null;
  error: string | null;
  duration: number | null;
  nextRun: string;
}

interface JobHistoryEntry {
  id: string;
  jobName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

const JOB_DESCRIPTIONS: Record<string, string> = {
  "subscription-search": "Search for new content from subscribed performers and studios",
  "metadata-refresh": "Update and fix missing metadata for scenes from StashDB and TPDB",
  "torrent-monitor": "Monitor torrent downloads and handle completions",
  "cleanup": "Remove old logs and cleanup temporary files",
};

export class SchedulerService {
  private db: BetterSQLite3Database<typeof import("@repo/database/schema")>;
  private logger: Logger;
  private container: ServiceContainer | null = null;

  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobSchedules: Map<string, string> = new Map();
  private initialized = false;

  constructor({
    db,
    logger,
  }: {
    db: Database;
    logger: Logger;
  }) {
    // Unwrap Promise - Database is Promise<DrizzleDB> but at runtime it's resolved
    this.db = db as unknown as BetterSQLite3Database<typeof import("@repo/database/schema")>;
    this.logger = logger;
  }

  /**
   * Set container after initialization (to avoid circular dependency)
   */
  setContainer(container: ServiceContainer): void {
    this.container = container;
  }

  /**
   * Initialize scheduler and register jobs from settings
   */
  async initialize(): Promise<void> {
    if (!this.container) {
      throw new Error("SchedulerService: container must be set before initialization");
    }

    if (this.initialized) {
      this.logger.warn("Scheduler already initialized");
      return;
    }

    // Get settings to determine which jobs to enable
    const settings = await this.container.settingsService.getSettings();

    // Register jobs based on settings
    this.registerJob({
      name: "subscription-search",
      schedule: settings.jobs.subscriptionSearch?.schedule || "0 * * * *",
      handler: async () => {
        const { subscriptionSearchJob: job } = this.container!;
        if (job) await job.execute();
      },
      enabled: settings.jobs.subscriptionSearch?.enabled ?? true,
    });

    this.registerJob({
      name: "metadata-refresh",
      schedule: settings.jobs.metadataRefresh?.schedule || "0 */6 * * *",
      handler: async () => {
        const { metadataRefreshJob: job } = this.container!;
        if (job) await job.execute();
      },
      enabled: settings.jobs.metadataRefresh?.enabled ?? true,
    });

    this.registerJob({
      name: "torrent-monitor",
      schedule: settings.jobs.torrentMonitor?.schedule || "*/5 * * * *",
      handler: async () => {
        const { torrentMonitorJob: job } = this.container!;
        if (job) await job.execute();
      },
      enabled: settings.jobs.torrentMonitor?.enabled ?? true,
    });

    this.registerJob({
      name: "cleanup",
      schedule: settings.jobs.cleanup?.schedule || "0 3 * * 0",
      handler: async () => {
        const { cleanupJob: job } = this.container!;
        if (job) await job.execute();
      },
      enabled: settings.jobs.cleanup?.enabled ?? true,
    });

    this.initialized = true;
    this.logger.info("Scheduler initialized with jobs");
  }

  /**
   * Register a job with the scheduler
   */
  private registerJob(job: JobDefinition): void {
    if (!job.enabled) {
      this.logger.info(`Job "${job.name}" is disabled, skipping registration`);
      return;
    }

    const task = cron.schedule(
      job.schedule,
      async () => {
        await this.executeJob(job.name, job.handler);
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );

    this.jobs.set(job.name, task);
    this.jobSchedules.set(job.name, job.schedule);
    this.logger.info(`Job "${job.name}" registered with schedule: ${job.schedule}`);
  }

  /**
   * Execute a job and record its status
   */
  private async executeJob(
    jobName: string,
    handler: () => Promise<void>,
    isManual = false
  ): Promise<void> {
    this.logger.info(`Starting job: ${jobName}`);
    const startTime = Date.now();
    const { nanoid } = await import("nanoid");
    const jobLogId = nanoid();

    try {
      // Record job start in database
      await this.db.insert(jobsLog).values({
        id: jobLogId,
        jobName,
        status: "running",
        startedAt: new Date().toISOString(),
        completedAt: null,
        errorMessage: null,
        metadata: { manual: isManual },
      });

      await handler();
      const duration = Date.now() - startTime;

      // Update job as completed
      await this.db
        .update(jobsLog)
        .set({
          status: "completed",
          completedAt: new Date().toISOString(),
          metadata: { duration, manual: isManual },
        })
        .where(eq(jobsLog.id, jobLogId));

      this.logger.info(`Job "${jobName}" completed in ${duration}ms`);
    } catch (error) {
      // Update job as failed
      await this.db
        .update(jobsLog)
        .set({
          status: "failed",
          completedAt: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        .where(eq(jobsLog.id, jobLogId));

      this.logger.error({ error, job: jobName }, `Job "${jobName}" failed`);
      throw error;
    }
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(jobName: string): Promise<void> {
    if (!this.container) {
      throw new Error("SchedulerService: container must be set before triggering jobs");
    }

    const jobHandlers: Record<string, () => Promise<void>> = {
      "subscription-search": async () => {
        const { subscriptionSearchJob: job } = this.container!;
        if (job) await job.execute();
      },
      "metadata-refresh": async () => {
        const { metadataRefreshJob: job } = this.container!;
        if (job) await job.execute();
      },
      "torrent-monitor": async () => {
        const { torrentMonitorJob: job } = this.container!;
        if (job) await job.execute();
      },
      "cleanup": async () => {
        const { cleanupJob: job } = this.container!;
        if (job) await job.execute();
      },
    };

    const handler = jobHandlers[jobName];
    if (!handler) {
      throw new Error(`Unknown job: ${jobName}`);
    }

    this.logger.info(`Manually triggering job: ${jobName}`);
    await this.executeJob(jobName, handler, true);
  }

  /**
   * Get all jobs with their status
   */
  async getJobs(): Promise<JobStatus[]> {
    const allJobNames = [
      "subscription-search",
      "metadata-refresh",
      "torrent-monitor",
      "cleanup",
    ];

    const jobsWithHistory = await Promise.all(
      allJobNames.map(async (name) => {
        const latestRun = await this.db.query.jobsLog.findFirst({
          where: eq(jobsLog.jobName, name),
          orderBy: [desc(jobsLog.startedAt)],
        });

        const duration =
          latestRun?.metadata &&
          typeof latestRun.metadata === "object" &&
          "duration" in latestRun.metadata
            ? (latestRun.metadata as any).duration ?? null
            : null;

        const schedule = this.jobSchedules.get(name);
        const nextRun = schedule ? this.getNextExecution(schedule) : null;

        return {
          id: name,
          name,
          description: JOB_DESCRIPTIONS[name] || "",
          schedule: schedule || "",
          enabled: this.jobs.has(name),
          status: latestRun?.status || "idle",
          lastRun: latestRun?.startedAt || null,
          completedAt: latestRun?.completedAt || null,
          error: latestRun?.errorMessage || null,
          duration,
          nextRun: nextRun ? nextRun.toISOString() : "",
        };
      })
    );

    return jobsWithHistory;
  }

  /**
   * Get job history
   */
  async getJobHistory(limit = 50): Promise<JobHistoryEntry[]> {
    const history = await this.db.query.jobsLog.findMany({
      orderBy: [desc(jobsLog.startedAt)],
      limit,
    });

    return history.map((row: any) => ({
      id: row.id,
      jobName: row.jobName,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      error: row.errorMessage,
      metadata: row.metadata || {},
    }));
  }

  /**
   * Stop all scheduled jobs
   */
  stopAllJobs(): void {
    this.jobs.forEach((task, name) => {
      task.stop();
      this.logger.info(`Job "${name}" stopped`);
    });
    this.jobs.clear();
  }

  /**
   * Calculate next execution time from cron expression
   */
  private getNextExecution(cronExpression: string): Date | null {
    try {
      const parser = (cronParser as any).default;
      const interval = parser.parseExpression(cronExpression);
      return interval.next().toDate();
    } catch {
      return null;
    }
  }

  /**
   * Check if scheduler is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
