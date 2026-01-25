import { z } from "zod";
import { IdParamsSchema } from "@/schemas/common.schema.js";

export const LogLevelSchema = z.enum(["error", "warning", "info", "debug"]);

// Allow any string for eventType since the database has values like "torrent-search"
export const EventTypeSchema = z.string();

export const LogSchema = z.object({
  id: z.string(),
  level: LogLevelSchema,
  eventType: EventTypeSchema,
  message: z.string(),
  details: z.union([
    z.record(z.unknown()),
    z.null(),
    z.undefined()
  ]).optional(), // Handle all possible return types from DB
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
    const cleaned: Record<string, unknown> = {};
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

export const LogParamsSchema = IdParamsSchema;

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
