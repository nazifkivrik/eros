/**
 * Job progress event types
 * Shared between backend and frontend for real-time job monitoring (SSE/WebSocket)
 */
import { z } from "zod";
import { JobNameSchema } from "./job.js";

export const JobProgressEventSchema = z.object({
  jobName: JobNameSchema,
  status: z.enum(["started", "progress", "completed", "failed"]),
  message: z.string(),
  progress: z.object({
    current: z.number(),
    total: z.number(),
    percentage: z.number(),
  }).optional(),
  data: z.record(z.unknown()).optional(),
  timestamp: z.string(),
});

// Tip schema'dan üret
export type JobProgressEvent = z.infer<typeof JobProgressEventSchema>;
