import type { Logger } from "pino";
import { TorrentsService } from "../../application/services/torrents.service.js";
import {
  TorrentHashParamsSchema,
  TorrentPrioritySchema,
  RemoveTorrentQuerySchema,
} from "../../modules/torrents/torrents.schema.js";

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
  async list() {
    return await this.torrentsService.getAllTorrents();
  }

  /**
   * Pause torrent by hash
   */
  async pause(params: unknown) {
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
  async resume(params: unknown) {
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
  async remove(params: unknown, query: unknown) {
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
  async setPriority(params: unknown, body: unknown) {
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
