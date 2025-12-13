/**
 * Job Progress Service
 * Emits real-time job progress events via SSE
 */

import { EventEmitter } from "events";

export interface JobProgressEvent {
  jobName: string;
  status: "started" | "progress" | "completed" | "failed";
  message: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  data?: Record<string, any>;
  timestamp: string;
}

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
  emitStarted(jobName: string, message: string, data?: Record<string, any>) {
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
    jobName: string,
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
    jobName: string,
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
  emitFailed(jobName: string, message: string, data?: Record<string, any>) {
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
