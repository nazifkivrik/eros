import { z } from "zod";

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
  ]).optional(),
  sceneId: z.string().nullable(),
  performerId: z.string().nullable(),
  studioId: z.string().nullable(),
  createdAt: z.string(),
});

// Tip schema'dan üret
export type LogLevel = z.infer<typeof LogLevelSchema>;
export type EventType = z.infer<typeof EventTypeSchema>;
export type LogEntry = z.infer<typeof LogSchema>;
