import { z } from "zod";
import {
  JobStatusSchema,
  JobHistoryItemSchema,
  JobNameSchema,
  JobsResponseSchema,
  JobHistoryResponseSchema,
  type JobStatus,
  type JobHistoryItem,
} from "@repo/shared-types";

// Re-export shared schemas
export {
  JobStatusSchema,
  JobHistoryItemSchema,
  JobNameSchema,
  type JobStatus,
  type JobHistoryItem,
};

// Backward compatibility
export const JobSchema = JobStatusSchema;
export type Job = JobStatus;

export const JobNameParamsSchema = z.object({
  jobName: JobNameSchema,
});

export const JobsListResponseSchema = JobsResponseSchema;
export const JobHistoryListResponseSchema = JobHistoryResponseSchema;

export const TriggerJobResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
