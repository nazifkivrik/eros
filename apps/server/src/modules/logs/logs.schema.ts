import { z } from "zod";

export const LogLevelSchema = z.enum(["error", "warning", "info", "debug"]);

export const EventTypeSchema = z.enum(["torrent", "subscription", "download", "metadata", "system"]);

export const LogSchema = z.object({
  id: z.string(),
  level: LogLevelSchema,
  eventType: EventTypeSchema,
  message: z.string(),
  details: z.record(z.unknown()).nullable(),
  sceneId: z.string().nullable(),
  performerId: z.string().nullable(),
  studioId: z.string().nullable(),
  createdAt: z.string(),
});

export const LogsQuerySchema = z
  .object({
    level: LogLevelSchema.optional(),
    eventType: EventTypeSchema.optional(),
    sceneId: z.string().optional(),
    performerId: z.string().optional(),
    studioId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.coerce.number().optional().default(100),
    offset: z.coerce.number().optional().default(0),
  })
  .transform((data) => {
    // Remove undefined/empty string values from optional fields
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== "" && value !== "undefined") {
        cleaned[key] = value;
      }
    }
    // Preserve default values
    if (!cleaned.limit) cleaned.limit = 100;
    if (!cleaned.offset) cleaned.offset = 0;
    return cleaned;
  });

export const LogParamsSchema = z.object({
  id: z.string(),
});

export const CleanupQuerySchema = z.object({
  daysToKeep: z.coerce.number().optional().default(30),
});

export const LogsListResponseSchema = z.object({
  data: z.array(LogSchema),
  total: z.number(),
});

export const CleanupResponseSchema = z.object({
  deletedCount: z.number(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});
