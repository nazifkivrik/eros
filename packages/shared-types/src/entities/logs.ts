/**
 * Logging Types
 * Shared between backend and frontend for log management
 */

import type { LogLevel, EventType } from "../enums.js";

export interface Log {
  id: string;
  level: LogLevel;
  eventType: EventType;
  message: string;
  details: Record<string, unknown> | null;
  sceneId: string | null;
  performerId: string | null;
  studioId: string | null;
  createdAt: string;
}

export interface LogFilters {
  level?: LogLevel;
  eventType?: EventType;
  sceneId?: string;
  performerId?: string;
  studioId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}
