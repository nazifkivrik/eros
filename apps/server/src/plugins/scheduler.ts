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

  registerJob({
    name: "metadata-discovery",
    schedule: settings.jobs.metadataDiscovery.schedule,
    handler: () => metadataDiscoveryJob(app),
    enabled: settings.jobs.metadataDiscovery.enabled,
  });

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
