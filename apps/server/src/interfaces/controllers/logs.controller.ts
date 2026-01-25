import type { Logger } from "pino";
import { z } from "zod";
import { LogsService } from "@/application/services/logs.service.js";
import {
  LogsQuerySchema,
  LogParamsSchema,
  CleanupQuerySchema,
  LogsListResponseSchema,
  LogSchema,
  CleanupResponseSchema,
} from "@/modules/logs/logs.schema.js";

/**
 * Logs Controller
 * Handles HTTP request/response for logs endpoints
 * Responsibilities:
 * - Request validation (Zod)
 * - Calling service methods
 * - Error handling
 * - Response formatting
 */
export class LogsController {
  private logsService: LogsService;
  private logger: Logger;

  constructor({
    logsService,
    logger,
  }: {
    logsService: LogsService;
    logger: Logger;
  }) {
    this.logsService = logsService;
    this.logger = logger;
  }

  /**
   * Get logs with filtering
   */
  async list(query: unknown): Promise<z.infer<typeof LogsListResponseSchema>> {
    const validated = LogsQuerySchema.parse(query) as {
      level?: "error" | "warning" | "info" | "debug";
      eventType?: "metadata" | "torrent" | "subscription" | "download" | "system" | "torrent-search";
      sceneId?: string;
      performerId?: string;
      studioId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };

    const result = await this.logsService.getLogs({
      level: validated.level,
      eventType: validated.eventType,
      sceneId: validated.sceneId,
      performerId: validated.performerId,
      studioId: validated.studioId,
      startDate: validated.startDate,
      endDate: validated.endDate,
      limit: validated.limit,
      offset: validated.offset,
    });

    return result;
  }

  /**
   * Get log by ID
   */
  async getById(params: unknown): Promise<z.infer<typeof LogSchema>> {
    const validated = LogParamsSchema.parse(params);
    const log = await this.logsService.getLog(validated.id);

    if (!log) {
      throw new Error("Log not found");
    }

    return log;
  }

  /**
   * Delete old logs
   */
  async cleanup(query: unknown): Promise<z.infer<typeof CleanupResponseSchema>> {
    const validated = CleanupQuerySchema.parse(query);
    const deletedCount = await this.logsService.deleteOldLogs(validated.daysToKeep);
    return { deletedCount };
  }
}
