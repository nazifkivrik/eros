/**
 * IJob Interface
 * Base interface for all job implementations
 * Jobs are background tasks that run on a schedule
 */

export interface IJob {
  /**
   * Unique identifier for this job
   */
  readonly name: string;

  /**
   * Human-readable description of what this job does
   */
  readonly description: string;

  /**
   * Execute the job
   * This method is called when the job is triggered (by scheduler or manually)
   */
  execute(): Promise<void>;
}
