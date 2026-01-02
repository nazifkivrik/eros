import type { LogLevel, EventType } from "../api/log.js";

export type LogDomain = {
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
