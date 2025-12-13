/**
 * Logs Service
 * Handles application logging with different levels and event types
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { logs } from "@repo/database";
import { nanoid } from "nanoid";
import type * as schema from "@repo/database";
import { desc, eq, and, gte, lte } from "drizzle-orm";

export type LogLevel = "error" | "warning" | "info" | "debug";
export type EventType = "torrent" | "subscription" | "download" | "metadata" | "system";

interface CreateLogInput {
  level: LogLevel;
  eventType: EventType;
  message: string;
  details?: Record<string, unknown>;
  sceneId?: string;
  performerId?: string;
  studioId?: string;
}

interface Log {
  id: string;
  level: string;
  eventType: string;
  message: string;
  details: Record<string, unknown> | null;
  sceneId: string | null;
  performerId: string | null;
  studioId: string | null;
  createdAt: string;
}

export class LogsService {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * Create a log entry
   */
  async createLog(input: CreateLogInput): Promise<Log> {
    const now = new Date().toISOString();

    const log = {
      id: nanoid(),
      level: input.level,
      eventType: input.eventType,
      message: input.message,
      details: input.details || null,
      sceneId: input.sceneId || null,
      performerId: input.performerId || null,
      studioId: input.studioId || null,
      createdAt: now,
    };

    await this.db.insert(logs).values(log);

    return log;
  }

  /**
   * Get logs with optional filtering
   */
  async getLogs(filters?: {
    level?: LogLevel;
    eventType?: EventType;
    sceneId?: string;
    performerId?: string;
    studioId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Log[]; total: number }> {
    const conditions = [];

    if (filters?.level) {
      conditions.push(eq(logs.level, filters.level));
    }
    if (filters?.eventType) {
      conditions.push(eq(logs.eventType, filters.eventType));
    }
    if (filters?.sceneId) {
      conditions.push(eq(logs.sceneId, filters.sceneId));
    }
    if (filters?.performerId) {
      conditions.push(eq(logs.performerId, filters.performerId));
    }
    if (filters?.studioId) {
      conditions.push(eq(logs.studioId, filters.studioId));
    }
    if (filters?.startDate) {
      conditions.push(gte(logs.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(logs.createdAt, filters.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await this.db.query.logs.findMany({
      where: whereClause,
      orderBy: [desc(logs.createdAt)],
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
    });

    // Get total count using SQL COUNT - MUCH more memory efficient
    const countQuery = this.db
      .select({ count: logs.id })
      .from(logs);
    
    if (whereClause) {
      countQuery.where(whereClause);
    }

    const countResult = await countQuery.all();
    const total = countResult.length;

    return {
      data: data as Log[],
      total,
    };
  }

  /**
   * Get log by ID
   */
  async getLog(id: string): Promise<Log | null> {
    const log = await this.db.query.logs.findFirst({
      where: eq(logs.id, id),
    });

    return (log as Log) || null;
  }

  /**
   * Delete old logs (cleanup)
   */
  async deleteOldLogs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.db
      .delete(logs)
      .where(lte(logs.createdAt, cutoffDate.toISOString()));

    return result.changes;
  }

  /**
   * Convenience methods for different log levels
   */
  async error(
    eventType: EventType,
    message: string,
    details?: Record<string, unknown>,
    entityIds?: { sceneId?: string; performerId?: string; studioId?: string }
  ): Promise<Log> {
    return this.createLog({
      level: "error",
      eventType,
      message,
      details,
      ...entityIds,
    });
  }

  async warning(
    eventType: EventType,
    message: string,
    details?: Record<string, unknown>,
    entityIds?: { sceneId?: string; performerId?: string; studioId?: string }
  ): Promise<Log> {
    return this.createLog({
      level: "warning",
      eventType,
      message,
      details,
      ...entityIds,
    });
  }

  async info(
    eventType: EventType,
    message: string,
    details?: Record<string, unknown>,
    entityIds?: { sceneId?: string; performerId?: string; studioId?: string }
  ): Promise<Log> {
    return this.createLog({
      level: "info",
      eventType,
      message,
      details,
      ...entityIds,
    });
  }

  async debug(
    eventType: EventType,
    message: string,
    details?: Record<string, unknown>,
    entityIds?: { sceneId?: string; performerId?: string; studioId?: string }
  ): Promise<Log> {
    return this.createLog({
      level: "debug",
      eventType,
      message,
      details,
      ...entityIds,
    });
  }
}

// Export factory function
export function createLogsService(db: BetterSQLite3Database<typeof schema>) {
  return new LogsService(db);
}
