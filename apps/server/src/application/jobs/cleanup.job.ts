/**
 * Cleanup Job
 * Removes old search history, job logs, and orphaned data
 * Runs weekly on Sunday at 3 AM
 */

import { BaseJob } from "./base.job.js";
import type { Logger } from "pino";
import type { JobProgressService } from "@/infrastructure/job-progress.service.js";
import type { JobsLogRepository } from "@/infrastructure/repositories/jobs.repository.js";
import type { SearchRepository } from "@/infrastructure/repositories/search.repository.js";
import type { DownloadQueueRepository } from "@/infrastructure/repositories/download-queue.repository.js";
import type { LogsRepository } from "@/infrastructure/repositories/logs.repository.js";
import type { Database } from "@repo/database";
import { lt, and, eq } from "drizzle-orm";
import { downloadQueue, logs } from "@repo/database";

export class CleanupJob extends BaseJob {
  readonly name = "cleanup";
  readonly description = "Remove old logs and cleanup temporary files";

  private jobsRepository: JobsLogRepository;
  private searchRepository: SearchRepository;
  private downloadQueueRepository: DownloadQueueRepository;
  private logsRepository: LogsRepository;
  private db: Database;

  constructor(deps: {
    logger: Logger;
    jobProgressService: JobProgressService;
    jobsRepository: JobsLogRepository;
    searchRepository: SearchRepository;
    downloadQueueRepository: DownloadQueueRepository;
    logsRepository: LogsRepository;
    db: Database;
  }) {
    super(deps);
    this.jobsRepository = deps.jobsRepository;
    this.searchRepository = deps.searchRepository;
    this.downloadQueueRepository = deps.downloadQueueRepository;
    this.logsRepository = deps.logsRepository;
    this.db = deps.db;
  }

  async execute(): Promise<void> {
    this.emitStarted("Starting cleanup job");
    this.logger.info("Starting cleanup job");

    try {
      const now = new Date();
      const totalTasks = 6;
      let currentTask = 0;

      // Remove search history older than 90 days
      this.emitProgress("Cleaning up search history...", currentTask++, totalTasks);
      const searchHistoryCutoff = new Date(now);
      searchHistoryCutoff.setDate(searchHistoryCutoff.getDate() - 90);

      const deletedSearchHistory = await this.searchRepository.deleteOldSearchHistory(
        searchHistoryCutoff.toISOString()
      );

      this.logger.info(
        `Deleted ${deletedSearchHistory} old search history records`
      );

      // Remove job logs older than 30 days
      this.emitProgress("Cleaning up job logs...", currentTask++, totalTasks);
      const jobLogsCutoff = new Date(now);
      jobLogsCutoff.setDate(jobLogsCutoff.getDate() - 30);

      this.logger.info("About to delete old job logs...");

      let deletedJobLogs = 0;
      try {
        deletedJobLogs = await this.jobsRepository.deleteOldJobLogs(
          jobLogsCutoff.toISOString()
        );
        this.logger.info(`Deleted ${deletedJobLogs} old job log records`);
      } catch (error) {
        this.logger.error({ error, errorMessage: error instanceof Error ? error.message : String(error), errorStack: error instanceof Error ? error.stack : undefined }, "Failed to delete old job logs");
        throw error;
      }

      // Remove failed download queue items older than 7 days
      this.emitProgress("Cleaning up failed download queue items...", currentTask++, totalTasks);
      const failedQueueCutoff = new Date(now);
      failedQueueCutoff.setDate(failedQueueCutoff.getDate() - 7);

      const deletedFailedQueue = await this.db
        .delete(downloadQueue)
        .where(
          and(
            eq(downloadQueue.status, "failed"),
            lt(downloadQueue.addedAt, failedQueueCutoff.toISOString())
          )
        )
        .returning({ id: downloadQueue.id });

      this.logger.info(
        `Deleted ${deletedFailedQueue.length} old failed download queue items`
      );

      // Remove completed download queue items older than 30 days
      this.emitProgress("Cleaning up completed download queue items...", currentTask++, totalTasks);
      const completedQueueCutoff = new Date(now);
      completedQueueCutoff.setDate(completedQueueCutoff.getDate() - 30);

      const deletedCompletedQueue = await this.db
        .delete(downloadQueue)
        .where(
          and(
            eq(downloadQueue.status, "completed"),
            lt(downloadQueue.addedAt, completedQueueCutoff.toISOString())
          )
        )
        .returning({ id: downloadQueue.id });

      this.logger.info(
        `Deleted ${deletedCompletedQueue.length} old completed download queue items`
      );

      // Remove logs older than 7 days (keep recent for debugging)
      // Keep only ERROR and WARNING logs for 30 days, INFO/DEBUG for 7 days
      this.emitProgress("Cleaning up system logs...", currentTask++, totalTasks);
      const errorWarningLogsCutoff = new Date(now);
      errorWarningLogsCutoff.setDate(errorWarningLogsCutoff.getDate() - 30);

      const deletedErrorWarningLogs = await this.db
        .delete(logs)
        .where(
          and(
            lt(logs.createdAt, errorWarningLogsCutoff.toISOString()),
            eq(logs.level, "error")
          )
        )
        .returning({ id: logs.id });

      const deletedWarningLogs = await this.db
        .delete(logs)
        .where(
          and(
            lt(logs.createdAt, errorWarningLogsCutoff.toISOString()),
            eq(logs.level, "warning")
          )
        )
        .returning({ id: logs.id });

      const infoDebugLogsCutoff = new Date(now);
      infoDebugLogsCutoff.setDate(infoDebugLogsCutoff.getDate() - 7);

      const deletedInfoLogs = await this.db
        .delete(logs)
        .where(
          and(
            lt(logs.createdAt, infoDebugLogsCutoff.toISOString()),
            eq(logs.level, "info")
          )
        )
        .returning({ id: logs.id });

      const deletedDebugLogs = await this.db
        .delete(logs)
        .where(
          and(
            lt(logs.createdAt, infoDebugLogsCutoff.toISOString()),
            eq(logs.level, "debug")
          )
        )
        .returning({ id: logs.id });

      const totalDeletedLogs =
        deletedErrorWarningLogs.length +
        deletedWarningLogs.length +
        deletedInfoLogs.length +
        deletedDebugLogs.length;

      this.logger.info(`Deleted ${totalDeletedLogs} old log records`);

      currentTask++;
      this.emitCompleted(
        `Cleanup completed: ${deletedSearchHistory} search history, ${deletedJobLogs} job logs, ${deletedFailedQueue.length + deletedCompletedQueue.length} queue items, ${totalDeletedLogs} system logs deleted`,
        {
          deletedSearchHistory,
          deletedJobLogs,
          deletedFailedQueue: deletedFailedQueue.length,
          deletedCompletedQueue: deletedCompletedQueue.length,
          totalDeletedLogs,
        }
      );

      this.logger.info("Cleanup job completed");
    } catch (error) {
      this.emitFailed(
        `Cleanup job failed: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error({ error }, "Cleanup job failed");
      throw error;
    }
  }
}
