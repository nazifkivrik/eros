import { z } from "zod";

export const JobNameSchema = z.enum([
  "subscription-search",
  "metadata-refresh",
  "torrent-monitor",
  "cleanup",
  "metadata-discovery",
]);

export const JobSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
});

export const JobNameParamsSchema = z.object({
  jobName: JobNameSchema,
});

export const JobsListResponseSchema = z.object({
  jobs: z.array(JobSchema),
});

export const TriggerJobResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});
