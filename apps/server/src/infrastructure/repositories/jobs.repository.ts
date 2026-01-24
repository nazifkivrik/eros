/**
 * Jobs Log Repository
 * Handles all database operations for job execution logs
 */

import type { Database } from "@repo/database";
import { jobsLog } from "@repo/database";
import { eq, desc, lt, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export type JobStatus = "running" | "completed" | "failed";

export interface CreateJobLogParams {
  jobName: string;
  status?: JobStatus;
  startedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateJobLogParams {
  status: JobStatus;
  completedAt?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface JobLogEntry {
  id: string;
  jobName: string;
  status: JobStatus;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
}

export class JobsLogRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Create a new job log entry
   */
  async createJobLog(params: CreateJobLogParams): Promise<string> {
    const id = nanoid();
    const now = new Date().toISOString();

    await this.db.insert(jobsLog).values({
      id,
      jobName: params.jobName,
      status: params.status || "running",
      startedAt: params.startedAt || now,
      metadata: params.metadata,
    });

    return id;
  }

  /**
   * Update job log status and completion info
   */
  async updateJobLog(
    id: string,
    params: UpdateJobLogParams
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status: params.status,
    };

    if (params.completedAt !== undefined) {
      updateData.completedAt = params.completedAt;
    }

    if (params.errorMessage !== undefined) {
      updateData.errorMessage = params.errorMessage;
    }

    if (params.metadata !== undefined) {
      updateData.metadata = params.metadata;
    }

    await this.db
      .update(jobsLog)
      .set(updateData as typeof jobsLog.$inferInsert)
      .where(eq(jobsLog.id, id));
  }

  /**
   * Get job history (all jobs, optionally filtered by job name)
   */
  async getJobHistory(options: {
    jobName?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobLogEntry[]> {
    let query = this.db
      .select()
      .from(jobsLog)
      .orderBy(desc(jobsLog.startedAt));

    if (options.jobName) {
      query = query.where(eq(jobsLog.jobName, options.jobName)) as typeof query;
    }

    if (options.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    if (options.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    const results = await query;
    return results as JobLogEntry[];
  }

  /**
   * Get latest job run for a specific job name
   */
  async getLatestJobRun(jobName: string): Promise<JobLogEntry | null> {
    const result = await this.db
      .select()
      .from(jobsLog)
      .where(eq(jobsLog.jobName, jobName))
      .orderBy(desc(jobsLog.startedAt))
      .limit(1);

    return (result[0] as JobLogEntry | null) ?? null;
  }

  /**
   * Get job log by ID
   */
  async getJobLogById(id: string): Promise<JobLogEntry | null> {
    const result = await this.db
      .select()
      .from(jobsLog)
      .where(eq(jobsLog.id, id))
      .limit(1);

    return (result[0] as JobLogEntry | null) ?? null;
  }

  /**
   * Delete old job logs (for cleanup job)
   */
  async deleteOldJobLogs(cutoffDate: string): Promise<number> {
    const result = await this.db
      .delete(jobsLog)
      .where(lt(jobsLog.startedAt, cutoffDate))
      .returning({ id: jobsLog.id });

    return result.length;
  }
}
