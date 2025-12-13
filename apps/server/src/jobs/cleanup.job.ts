/**
 * Cleanup Job
 * Removes old search history, job logs, and orphaned data
 * Runs weekly on Sunday at 3 AM
 */

import type { FastifyInstance } from "fastify";
import { lt, and, eq } from "drizzle-orm";
import { searchHistory, jobsLog, downloadQueue, logs } from "@repo/database";

export async function cleanupJob(app: FastifyInstance) {
  app.log.info("Starting cleanup job");

  try {
    const now = new Date();

    // Remove search history older than 90 days
    const searchHistoryCutoff = new Date(now);
    searchHistoryCutoff.setDate(searchHistoryCutoff.getDate() - 90);

    const deletedSearchHistory = await app.db
      .delete(searchHistory)
      .where(lt(searchHistory.searchedAt, searchHistoryCutoff.toISOString()))
      .returning({ id: searchHistory.id });

    app.log.info(
      `Deleted ${deletedSearchHistory.length} old search history records`
    );

    // Remove job logs older than 30 days
    const jobLogsCutoff = new Date(now);
    jobLogsCutoff.setDate(jobLogsCutoff.getDate() - 30);

    const deletedJobLogs = await app.db
      .delete(jobsLog)
      .where(lt(jobsLog.startedAt, jobLogsCutoff.toISOString()))
      .returning({ id: jobsLog.id });

    app.log.info(`Deleted ${deletedJobLogs.length} old job log records`);

    // Remove failed download queue items older than 7 days
    const failedQueueCutoff = new Date(now);
    failedQueueCutoff.setDate(failedQueueCutoff.getDate() - 7);

    const deletedFailedQueue = await app.db
      .delete(downloadQueue)
      .where(
        and(
          eq(downloadQueue.status, "failed"),
          lt(downloadQueue.addedAt, failedQueueCutoff.toISOString())
        )
      )
      .returning({ id: downloadQueue.id });

    app.log.info(
      `Deleted ${deletedFailedQueue.length} old failed download queue items`
    );

    // Remove completed download queue items older than 30 days
    const completedQueueCutoff = new Date(now);
    completedQueueCutoff.setDate(completedQueueCutoff.getDate() - 30);

    const deletedCompletedQueue = await app.db
      .delete(downloadQueue)
      .where(
        and(
          eq(downloadQueue.status, "completed"),
          lt(downloadQueue.addedAt, completedQueueCutoff.toISOString())
        )
      )
      .returning({ id: downloadQueue.id });

    app.log.info(
      `Deleted ${deletedCompletedQueue.length} old completed download queue items`
    );

    // Remove logs older than 7 days (keep recent for debugging)
    // Keep only ERROR and WARNING logs for 30 days, INFO/DEBUG for 7 days
    const errorWarningLogsCutoff = new Date(now);
    errorWarningLogsCutoff.setDate(errorWarningLogsCutoff.getDate() - 30);

    const deletedErrorWarningLogs = await app.db
      .delete(logs)
      .where(
        and(
          lt(logs.createdAt, errorWarningLogsCutoff.toISOString()),
          eq(logs.level, "error")
        )
      )
      .returning({ id: logs.id });

    const deletedWarningLogs = await app.db
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

    const deletedInfoLogs = await app.db
      .delete(logs)
      .where(
        and(
          lt(logs.createdAt, infoDebugLogsCutoff.toISOString()),
          eq(logs.level, "info")
        )
      )
      .returning({ id: logs.id });

    const deletedDebugLogs = await app.db
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

    app.log.info(`Deleted ${totalDeletedLogs} old log records`);

    app.log.info("Cleanup job completed");
  } catch (error) {
    app.log.error({ error }, "Cleanup job failed");
    throw error;
  }
}
