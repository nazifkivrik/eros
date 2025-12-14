/**
 * Job Progress Types
 * Shared between backend and frontend for job monitoring
 */

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
