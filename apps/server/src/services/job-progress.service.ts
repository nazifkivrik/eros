/**
 * Job Progress Service
 * Emits real-time job progress events via SSE
 */

import { EventEmitter } from "events";
import type { JobProgressEvent, JobName } from "@repo/shared-types";

export class JobProgressService extends EventEmitter {
  private static instance: JobProgressService;

  private constructor() {
    super();
    this.setMaxListeners(100); // Allow many SSE clients
  }

  static getInstance(): JobProgressService {
    if (!JobProgressService.instance) {
      JobProgressService.instance = new JobProgressService();
    }
    return JobProgressService.instance;
  }

  /**
   * Emit job started event
   */
  emitStarted(jobName: JobName, message: string, data?: Record<string, any>) {
    const event: JobProgressEvent = {
      jobName,
      status: "started",
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    this.emit("job-progress", event);
  }

  /**
   * Emit job progress event
   */
  emitProgress(
    jobName: JobName,
    message: string,
    current: number,
    total: number,
    data?: Record<string, any>
  ) {
    const event: JobProgressEvent = {
      jobName,
      status: "progress",
      message,
      progress: {
        current,
        total,
        percentage: Math.round((current / total) * 100),
      },
      data,
      timestamp: new Date().toISOString(),
    };
    this.emit("job-progress", event);
  }

  /**
   * Emit job completed event
   */
  emitCompleted(
    jobName: JobName,
    message: string,
    data?: Record<string, any>
  ) {
    const event: JobProgressEvent = {
      jobName,
      status: "completed",
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    this.emit("job-progress", event);
  }

  /**
   * Emit job failed event
   */
  emitFailed(jobName: JobName, message: string, data?: Record<string, any>) {
    const event: JobProgressEvent = {
      jobName,
      status: "failed",
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    this.emit("job-progress", event);
  }
}

// Export singleton instance
export function getJobProgressService(): JobProgressService {
  return JobProgressService.getInstance();
}
