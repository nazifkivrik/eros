import type { LogLevel, EventType } from "@repo/shared-types";

/**
 * Log entity type
 * Server-only - not exposed to frontend in this shape
 */
export type Log = {
  id: string;
  level: LogLevel;
  eventType: EventType;
  message: string;
  details: Record<string, unknown> | null;
  sceneId: string | null;
  performerId: string | null;
  studioId: string | null;
  createdAt: string;
};

/**
 * Log query filters
 * Used by logs service and routes
 */
export type LogFilters = {
  level?: LogLevel;
  eventType?: EventType;
  sceneId?: string;
  performerId?: string;
  studioId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
};
