import { z } from "zod";

export const JobNameSchema = z.enum([
  "subscription-search",
  "metadata-refresh",
  "torrent-monitor",
  "cleanup",
]);

export const JobStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  schedule: z.string(),
  enabled: z.boolean(),
  status: z.string(),
  lastRun: z.string().nullable(),
  completedAt: z.string().nullable(),
  error: z.string().nullable(),
  duration: z.number().nullable(),
  nextRun: z.string(),
});

export const JobHistoryItemSchema = z.object({
  id: z.string(),
  jobName: z.string(),
  status: z.string(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  error: z.string().nullable(),
  metadata: z.record(z.unknown()),
});

export const JobsResponseSchema = z.object({
  jobs: z.array(JobStatusSchema),
});

export const JobHistoryResponseSchema = z.object({
  jobs: z.array(JobHistoryItemSchema),
});

// Backward compatibility - JobSchema is now JobStatusSchema
export const JobSchema = JobStatusSchema;

// Tip schema'dan üret
export type JobName = z.infer<typeof JobNameSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type JobHistoryItem = z.infer<typeof JobHistoryItemSchema>;
export type JobsResponse = z.infer<typeof JobsResponseSchema>;
export type JobHistoryResponse = z.infer<typeof JobHistoryResponseSchema>;
export type Job = JobStatus; // Backward compatibility
