/**
 * Base Job Class
 * Abstract base class for all job implementations
 * Provides common functionality for progress tracking and logging
 */

import type { Logger } from "pino";
import type { JobProgressService } from "../../infrastructure/job-progress.service.js";
import type { IJob } from "./job.interface.js";
import type { JobName } from "@repo/shared-types";

export abstract class BaseJob implements IJob {
  abstract readonly name: JobName;
  abstract readonly description: string;

  protected logger: Logger;
  protected progressService: JobProgressService;

  constructor(deps: { logger: Logger; progressService: JobProgressService }) {
    this.logger = deps.logger;
    this.progressService = deps.progressService;
  }

  abstract execute(): Promise<void>;

  /**
   * Emit job started event
   */
  protected emitStarted(message: string): void {
    this.progressService.emitStarted(this.name, message);
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
    this.progressService.emitProgress(this.name, message, current, total, metadata);
  }

  /**
   * Emit job completed event
   */
  protected emitCompleted(message: string, metadata?: Record<string, unknown>): void {
    this.progressService.emitCompleted(this.name, message, metadata);
  }

  /**
   * Emit job failed event
   */
  protected emitFailed(message: string, metadata?: Record<string, unknown>): void {
    this.progressService.emitFailed(this.name, message, metadata);
  }
}
