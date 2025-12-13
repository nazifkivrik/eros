/**
 * Job Scheduler Plugin
 * Manages background jobs using node-cron
 */

import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import cron from "node-cron";

// Jobs
import { subscriptionSearchJob } from "../jobs/subscription-search.job.js";
import { metadataRefreshJob } from "../jobs/metadata-refresh.job.js";
import { torrentMonitorJob } from "../jobs/torrent-monitor.job.js";
import { cleanupJob } from "../jobs/cleanup.job.js";
import { metadataDiscoveryJob } from "../jobs/metadata-discovery.job.js";
import { missingScenesSearchJob } from "../jobs/missing-scenes-search.job.js";
import { unifiedSyncJob } from "../jobs/unified-sync.job.js";
import { qbittorrentCleanupJob } from "../jobs/qbittorrent-cleanup.job.js";

interface JobDefinition {
  name: string;
  schedule: string; // cron expression
  handler: () => Promise<void>;
  enabled: boolean;
}

const schedulerPlugin: FastifyPluginAsync = async (app) => {
  const jobs: Map<string, cron.ScheduledTask> = new Map();

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

        try {
          await job.handler();
          const duration = Date.now() - startTime;
          app.log.info(`Job "${job.name}" completed in ${duration}ms`);
        } catch (error) {
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
      "metadata-discovery": () => metadataDiscoveryJob(app),
      "missing-scenes-search": () => missingScenesSearchJob(app),
      "unified-sync": () => unifiedSyncJob(app),
      "qbittorrent-cleanup": () => qbittorrentCleanupJob(app),
    };

    const handler = jobHandlers[jobName];
    if (!handler) {
      throw new Error(`Unknown job: ${jobName}`);
    }

    app.log.info(`Manually triggering job: ${jobName}`);
    await handler();
  };

  const getJobs = () => {
    return Array.from(jobs.keys()).map((name) => ({
      name,
      enabled: jobs.has(name),
    }));
  };

  // Expose job management methods
  app.decorate("scheduler", {
    registerJob,
    stopAllJobs,
    triggerJob,
    getJobs,
  });

  // Register jobs
  registerJob({
    name: "subscription-search",
    schedule: process.env.JOB_SUBSCRIPTION_SEARCH_CRON || "0 */6 * * *", // Every 6 hours
    handler: () => subscriptionSearchJob(app),
    enabled: process.env.JOB_SUBSCRIPTION_SEARCH_ENABLED !== "false",
  });

  registerJob({
    name: "metadata-refresh",
    schedule: process.env.JOB_METADATA_REFRESH_CRON || "0 2 * * *", // Daily at 2 AM
    handler: () => metadataRefreshJob(app),
    enabled: process.env.JOB_METADATA_REFRESH_ENABLED !== "false",
  });

  registerJob({
    name: "torrent-monitor",
    schedule: process.env.JOB_TORRENT_MONITOR_CRON || "*/5 * * * *", // Every 5 minutes
    handler: () => torrentMonitorJob(app),
    enabled: process.env.JOB_TORRENT_MONITOR_ENABLED !== "false",
  });

  registerJob({
    name: "cleanup",
    schedule: process.env.JOB_CLEANUP_CRON || "0 3 * * 0", // Weekly on Sunday at 3 AM
    handler: () => cleanupJob(app),
    enabled: process.env.JOB_CLEANUP_ENABLED !== "false",
  });

  registerJob({
    name: "metadata-discovery",
    schedule: process.env.JOB_METADATA_DISCOVERY_CRON || "0 3 * * *", // Daily at 3 AM
    handler: () => metadataDiscoveryJob(app),
    enabled: process.env.JOB_METADATA_DISCOVERY_ENABLED !== "false",
  });

  registerJob({
    name: "missing-scenes-search",
    schedule: process.env.JOB_MISSING_SCENES_SEARCH_CRON || "0 */8 * * *", // Every 8 hours
    handler: () => missingScenesSearchJob(app),
    enabled: process.env.JOB_MISSING_SCENES_SEARCH_ENABLED !== "false",
  });

  registerJob({
    name: "unified-sync",
    schedule: process.env.JOB_UNIFIED_SYNC_CRON || "*/10 * * * *", // Every 10 minutes
    handler: () => unifiedSyncJob(app),
    enabled: process.env.JOB_UNIFIED_SYNC_ENABLED !== "false",
  });

  registerJob({
    name: "qbittorrent-cleanup",
    schedule: process.env.JOB_QBITTORRENT_CLEANUP_CRON || "0 4 * * *", // Daily at 4 AM
    handler: () => qbittorrentCleanupJob(app),
    enabled: process.env.JOB_QBITTORRENT_CLEANUP_ENABLED !== "false",
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
      getJobs: () => Array<{ name: string; enabled: boolean }>;
    };
  }
}
