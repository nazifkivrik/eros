/**
 * Base Job Class
 * Abstract base class for all job implementations
 * Provides common functionality for progress tracking and logging
 */

import type { Logger } from "pino";
import type { JobProgressService } from "@/infrastructure/job-progress.service.js";
import type { IJob } from "./job.interface.js";
import type { JobName } from "@repo/shared-types";

export abstract class BaseJob implements IJob {
  abstract readonly name: JobName;
  abstract readonly description: string;

  protected logger: Logger;
  protected jobProgressService: JobProgressService;

  constructor(deps: { logger: Logger; jobProgressService: JobProgressService }) {
    this.logger = deps.logger;
    this.jobProgressService = deps.jobProgressService;
  }

  abstract execute(): Promise<void>;

  /**
   * Emit job started event
   */
  protected emitStarted(message: string): void {
    this.jobProgressService.emitStarted(this.name, message);
  }

  /**
   * Emit job progress event
   */
  protected emitProgress(
    message: string,
    current: number,
    total: number,
    metadata?: Record<string, unknown>
  ): void {
    this.jobProgressService.emitProgress(this.name, message, current, total, metadata);
  }

  /**
   * Emit job completed event
   */
  protected emitCompleted(message: string, metadata?: Record<string, unknown>): void {
    this.jobProgressService.emitCompleted(this.name, message, metadata);
  }

  /**
   * Emit job failed event
   */
  protected emitFailed(message: string, metadata?: Record<string, unknown>): void {
    this.jobProgressService.emitFailed(this.name, message, metadata);
  }
}
