import type { Logger } from "pino";
import { z } from "zod";
import { TorrentsService } from "@/application/services/torrents.service.js";
import {
  TorrentHashParamsSchema,
  TorrentPrioritySchema,
  RemoveTorrentQuerySchema,
  TorrentListResponseSchema,
} from "@/modules/torrents/torrents.schema.js";

/**
 * Torrents Controller
 * Handles HTTP request/response for torrent endpoints
 * Responsibilities:
 * - Request validation (Zod)
 * - Calling service methods
 * - Error handling
 * - Response formatting
 */
export class TorrentsController {
  private torrentsService: TorrentsService;
  private logger: Logger;

  constructor({
    torrentsService,
    logger,
  }: {
    torrentsService: TorrentsService;
    logger: Logger;
  }) {
    this.torrentsService = torrentsService;
    this.logger = logger;
  }

  /**
   * List all torrents
   */
  async list(): Promise<z.infer<typeof TorrentListResponseSchema>> {
    return await this.torrentsService.getAllTorrents() as z.infer<typeof TorrentListResponseSchema>;
  }

  /**
   * Pause torrent by hash
   */
  async pause(params: unknown): Promise<{
    success: boolean;
    message: string;
  }> {
    const { hash } = TorrentHashParamsSchema.parse(params);

    const success = await this.torrentsService.pauseTorrent(hash);

    if (!success) {
      throw new Error(`Torrent ${hash} not found`);
    }

    return {
      success: true,
      message: `Torrent ${hash} paused`,
    };
  }

  /**
   * Resume torrent by hash
   */
  async resume(params: unknown): Promise<{
    success: boolean;
    message: string;
  }> {
    const { hash } = TorrentHashParamsSchema.parse(params);

    const success = await this.torrentsService.resumeTorrent(hash);

    if (!success) {
      throw new Error(`Torrent ${hash} not found`);
    }

    return {
      success: true,
      message: `Torrent ${hash} resumed`,
    };
  }

  /**
   * Remove torrent by hash
   */
  async remove(params: unknown, query: unknown): Promise<{
    success: boolean;
    message: string;
  }> {
    const { hash } = TorrentHashParamsSchema.parse(params);
    const { deleteFiles } = RemoveTorrentQuerySchema.parse(query);

    const success = await this.torrentsService.removeTorrent(
      hash,
      deleteFiles || false
    );

    if (!success) {
      throw new Error(`Torrent ${hash} not found`);
    }

    return {
      success: true,
      message: `Torrent ${hash} removed${deleteFiles ? " with files" : ""}`,
    };
  }

  /**
   * Change torrent priority
   */
  async setPriority(params: unknown, body: unknown): Promise<{
    success: boolean;
    message: string;
  }> {
    const { hash } = TorrentHashParamsSchema.parse(params);
    const { priority } = TorrentPrioritySchema.parse(body);

    const success = await this.torrentsService.setTorrentPriority(
      hash,
      priority
    );

    if (!success) {
      throw new Error(`Torrent ${hash} not found`);
    }

    return {
      success: true,
      message: `Torrent ${hash} priority changed to ${priority}`,
    };
  }
}
