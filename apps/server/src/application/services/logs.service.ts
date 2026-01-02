import { nanoid } from "nanoid";
import type { Logger } from "pino";
import type { LogLevel, EventType } from "@repo/shared-types";
import { LogsRepository } from "../../infrastructure/repositories/logs.repository.js";

/**
 * DTOs for Logs Service
 */
export interface CreateLogDTO {
  level: LogLevel;
  eventType: EventType;
  message: string;
  details?: Record<string, unknown>;
  sceneId?: string;
  performerId?: string;
  studioId?: string;
}

export interface LogFiltersDTO {
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

/**
 * Logs Service (Clean Architecture)
 * Business logic for application logging
 * Handles log creation, filtering, and cleanup
 */
export class LogsService {
  private logsRepository: LogsRepository;
  private logger: Logger;

  constructor({ logsRepository, logger }: { logsRepository: LogsRepository; logger: Logger }) {
    this.logsRepository = logsRepository;
    this.logger = logger;
  }

  /**
   * Create a log entry
   */
  async createLog(dto: CreateLogDTO) {
    const now = new Date().toISOString();

    const logData = {
      id: nanoid(),
      level: dto.level,
      eventType: dto.eventType,
      message: dto.message,
      details: dto.details || null,
      sceneId: dto.sceneId || null,
      performerId: dto.performerId || null,
      studioId: dto.studioId || null,
      createdAt: now,
    };

    return await this.logsRepository.create(logData);
  }

  /**
   * Get logs with optional filtering
   */
  async getLogs(filters?: LogFiltersDTO) {
    this.logger.debug({ filters }, "Fetching logs with filters");

    const [data, total] = await Promise.all([
      this.logsRepository.findMany(filters),
      this.logsRepository.count(filters),
    ]);

    return {
      data,
      total,
    };
  }

  /**
   * Get log by ID
   */
  async getLog(id: string) {
    this.logger.debug({ logId: id }, "Fetching log by ID");
    const log = await this.logsRepository.findById(id);
    return log || null;
  }

  /**
   * Delete old logs (cleanup)
   * Business logic: Calculate cutoff date based on days to keep
   */
  async deleteOldLogs(daysToKeep: number = 30): Promise<number> {
    this.logger.info({ daysToKeep }, "Deleting old logs");

    // Business logic: Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deletedCount = await this.logsRepository.deleteOlderThan(
      cutoffDate.toISOString()
    );

    this.logger.info({ deletedCount }, "Old logs deleted");
    return deletedCount;
  }

  /**
   * Convenience methods for different log levels
   */
  async error(
    eventType: EventType,
    message: string,
    details?: Record<string, unknown>,
    entityIds?: { sceneId?: string; performerId?: string; studioId?: string }
  ) {
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
  ) {
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
  ) {
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
  ) {
    return this.createLog({
      level: "debug",
      eventType,
      message,
      details,
      ...entityIds,
    });
  }
}
