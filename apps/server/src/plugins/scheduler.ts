/**
 * Job Scheduler Plugin
 * Manages background jobs using node-cron
 */

import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import cron from "node-cron";
import { jobsLog } from "@repo/database";
import { desc, eq } from "drizzle-orm";

// Jobs
import { subscriptionSearchJob } from "../jobs/subscription-search.job.js";
import { metadataRefreshJob } from "../jobs/metadata-refresh.job.js";
import { torrentMonitorJob } from "../jobs/torrent-monitor.job.js";
import { cleanupJob } from "../jobs/cleanup.job.js";
// import { metadataDiscoveryJob } from "../jobs/metadata-discovery.job.js"; // DISABLED: StashDB dependent
import { missingScenesSearchJob } from "../jobs/missing-scenes-search.job.js";
import { unifiedSyncJob } from "../jobs/unified-sync.job.js";
import { qbittorrentCleanupJob } from "../jobs/qbittorrent-cleanup.job.js";
import { hashGenerationJob } from "../jobs/hash-generation.job.js";

interface JobDefinition {
  name: string;
  schedule: string; // cron expression
  handler: () => Promise<void>;
  enabled: boolean;
}

const schedulerPlugin: FastifyPluginAsync = async (app) => {
  // Wait for plugins to be ready
  await app.after();

  const jobs: Map<string, cron.ScheduledTask> = new Map();

  // Get settings
  const { createSettingsService } = await import("../services/settings.service.js");
  const settingsService = createSettingsService(app.db);
  const settings = await settingsService.getSettings();

  // Register a job
  const registerJob = (job: JobDefinition) => {
    if (!job.enabled) {
      app.log.info(`Job "${job.name}" is disabled, skipping registration`);
      return;
    }

    const task = cron.schedule(
      job.schedule,
      async () => {
        app.log.info(`Starting job: ${job.name}`);
        const startTime = Date.now();
        const { nanoid } = await import("nanoid");
        const jobLogId = nanoid();

        try {
          // Record job start in database
          await app.db.insert(jobsLog).values({
            id: jobLogId,
            jobName: job.name,
            status: "running",
            startedAt: new Date().toISOString(),
            completedAt: null,
            errorMessage: null,
            metadata: {},
          });

          await job.handler();
          const duration = Date.now() - startTime;

          // Update job as completed
          await app.db
            .update(jobsLog)
            .set({
              status: "completed",
              completedAt: new Date().toISOString(),
              metadata: { duration },
            })
            .where(eq(jobsLog.id, jobLogId));

          app.log.info(`Job "${job.name}" completed in ${duration}ms`);
        } catch (error) {
          // Update job as failed
          await app.db
            .update(jobsLog)
            .set({
              status: "failed",
              completedAt: new Date().toISOString(),
              errorMessage: error instanceof Error ? error.message : String(error),
            })
            .where(eq(jobsLog.id, jobLogId));

          app.log.error(
            { error, job: job.name },
            `Job "${job.name}" failed`
          );
        }
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );

    jobs.set(job.name, task);
    app.log.info(`Job "${job.name}" registered with schedule: ${job.schedule}`);
  };

  // Stop all jobs
  const stopAllJobs = () => {
    jobs.forEach((task, name) => {
      task.stop();
      app.log.info(`Job "${name}" stopped`);
    });
    jobs.clear();
  };

  // Manual job trigger methods
  const triggerJob = async (jobName: string) => {
    const jobHandlers: Record<string, () => Promise<void>> = {
      "subscription-search": () => subscriptionSearchJob(app),
      "metadata-refresh": () => metadataRefreshJob(app),
      "torrent-monitor": () => torrentMonitorJob(app),
      "cleanup": () => cleanupJob(app),
      // "metadata-discovery": () => metadataDiscoveryJob(app), // DISABLED: StashDB dependent
      "missing-scenes-search": () => missingScenesSearchJob(app),
      "unified-sync": () => unifiedSyncJob(app),
      "qbittorrent-cleanup": () => qbittorrentCleanupJob(app),
      "hash-generation": () => hashGenerationJob(app),
    };

    const handler = jobHandlers[jobName];
    if (!handler) {
      throw new Error(`Unknown job: ${jobName}`);
    }

    app.log.info(`Manually triggering job: ${jobName}`);
    const startTime = Date.now();
    const { nanoid } = await import("nanoid");
    const jobLogId = nanoid();

    try {
      // Record job start in database
      await app.db.insert(jobsLog).values({
        id: jobLogId,
        jobName: jobName,
        status: "running",
        startedAt: new Date().toISOString(),
        completedAt: null,
        errorMessage: null,
        metadata: { manual: true },
      });

      await handler();
      const duration = Date.now() - startTime;

      // Update job as completed
      await app.db
        .update(jobsLog)
        .set({
          status: "completed",
          completedAt: new Date().toISOString(),
          metadata: { duration, manual: true },
        })
        .where(eq(jobsLog.id, jobLogId));

      app.log.info(`Job "${jobName}" completed in ${duration}ms`);
    } catch (error) {
      // Update job as failed
      await app.db
        .update(jobsLog)
        .set({
          status: "failed",
          completedAt: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        .where(eq(jobsLog.id, jobLogId));

      app.log.error({ error, job: jobName }, `Job "${jobName}" failed`);
      throw error;
    }
  };

  const getJobs = async () => {
    const jobNames = Array.from(jobs.keys());

    // Get the latest execution for each job from jobs_log
    const jobsWithHistory = await Promise.all(
      jobNames.map(async (name) => {
        const latestRun = await app.db.query.jobsLog.findFirst({
          where: eq(jobsLog.jobName, name),
          orderBy: [desc(jobsLog.startedAt)],
        });

        return {
          name,
          enabled: jobs.has(name),
          status: latestRun?.status || "idle",
          lastRun: latestRun?.startedAt || null,
          completedAt: latestRun?.completedAt || null,
          error: latestRun?.errorMessage || null,
          duration:
            latestRun?.metadata && typeof latestRun.metadata === "object"
              ? (latestRun.metadata as any).duration
              : null,
        };
      })
    );

    return jobsWithHistory;
  };

  // Get all job history
  const getJobHistory = async (limit = 50) => {
    const history = await app.db.query.jobsLog.findMany({
      orderBy: [desc(jobsLog.startedAt)],
      limit,
    });

    return history.map((row) => ({
      id: row.id,
      jobName: row.jobName,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      error: row.errorMessage,
      metadata: row.metadata || {},
    }));
  };

  // Expose job management methods
  app.decorate("scheduler", {
    registerJob,
    stopAllJobs,
    triggerJob,
    getJobs,
    getJobHistory,
  });

  // Register jobs from settings
  registerJob({
    name: "subscription-search",
    schedule: settings.jobs.subscriptionSearch.schedule,
    handler: () => subscriptionSearchJob(app),
    enabled: settings.jobs.subscriptionSearch.enabled,
  });

  registerJob({
    name: "metadata-refresh",
    schedule: settings.jobs.metadataRefresh.schedule,
    handler: () => metadataRefreshJob(app),
    enabled: settings.jobs.metadataRefresh.enabled,
  });

  registerJob({
    name: "torrent-monitor",
    schedule: settings.jobs.torrentMonitor.schedule,
    handler: () => torrentMonitorJob(app),
    enabled: settings.jobs.torrentMonitor.enabled,
  });

  registerJob({
    name: "cleanup",
    schedule: settings.jobs.cleanup.schedule,
    handler: () => cleanupJob(app),
    enabled: settings.jobs.cleanup.enabled,
  });

  // DISABLED: StashDB dependent - uses app.stashdb
  // registerJob({
  //   name: "metadata-discovery",
  //   schedule: settings.jobs.metadataDiscovery.schedule,
  //   handler: () => metadataDiscoveryJob(app),
  //   enabled: settings.jobs.metadataDiscovery.enabled,
  // });

  registerJob({
    name: "missing-scenes-search",
    schedule: settings.jobs.missingScenesSearch.schedule,
    handler: () => missingScenesSearchJob(app),
    enabled: settings.jobs.missingScenesSearch.enabled,
  });

  registerJob({
    name: "unified-sync",
    schedule: settings.jobs.unifiedSync.schedule,
    handler: () => unifiedSyncJob(app),
    enabled: settings.jobs.unifiedSync.enabled,
  });

  registerJob({
    name: "qbittorrent-cleanup",
    schedule: settings.jobs.qbittorrentCleanup.schedule,
    handler: () => qbittorrentCleanupJob(app),
    enabled: settings.jobs.qbittorrentCleanup.enabled,
  });

  registerJob({
    name: "hash-generation",
    schedule: settings.jobs.hashGeneration.schedule,
    handler: () => hashGenerationJob(app),
    enabled: settings.jobs.hashGeneration.enabled,
  });

  // Cleanup on server shutdown
  app.addHook("onClose", async () => {
    app.log.info("Stopping all scheduled jobs...");
    stopAllJobs();
  });

  app.log.info("Scheduler plugin registered");
};

export default fp(schedulerPlugin, {
  name: "scheduler",
});

// Extend Fastify types
declare module "fastify" {
  interface FastifyInstance {
    scheduler: {
      registerJob: (job: JobDefinition) => void;
      stopAllJobs: () => void;
      triggerJob: (jobName: string) => Promise<void>;
      getJobs: () => Promise<
        Array<{
          name: string;
          enabled: boolean;
          status: string;
          lastRun: string | null;
          completedAt: string | null;
          error: string | null;
          duration: number | null;
        }>
      >;
      getJobHistory: (limit?: number) => Promise<
        Array<{
          id: string;
          jobName: string;
          status: string;
          startedAt: string;
          completedAt: string | null;
          error: string | null;
          metadata: Record<string, any>;
        }>
      >;
    };
  }
}
