import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { Database } from "@repo/database";
import { logs } from "@repo/database";
import type { LogLevel, EventType } from "@repo/shared-types";

/**
 * Logs Repository
 * Handles all database operations for application logs
 * Pure data access - no business logic
 */
export class LogsRepository {
  private db: Database;
  constructor({ db }: { db: Database }) {
    this.db = db;
  }

  /**
   * Create a log entry
   */
  async create(data: typeof logs.$inferInsert) {
    await this.db.insert(logs).values(data);
    return data;
  }

  /**
   * Find logs with filters
   */
  async findMany(filters?: {
    level?: LogLevel;
    eventType?: EventType;
    sceneId?: string;
    performerId?: string;
    studioId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
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

    return data;
  }

  /**
   * Count logs with filters
   */
  async count(filters?: {
    level?: LogLevel;
    eventType?: EventType;
    sceneId?: string;
    performerId?: string;
    studioId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<number> {
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

    const countQuery = this.db.select({ count: logs.id }).from(logs);

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const countResult = await countQuery.all();
    return countResult.length;
  }

  /**
   * Find log by ID
   */
  async findById(id: string) {
    return await this.db.query.logs.findFirst({
      where: eq(logs.id, id),
    });
  }

  /**
   * Delete logs older than cutoff date
   */
  async deleteOlderThan(cutoffDate: string): Promise<number> {
    const result = await this.db
      .delete(logs)
      .where(lte(logs.createdAt, cutoffDate));

    return result.changes;
  }
}
