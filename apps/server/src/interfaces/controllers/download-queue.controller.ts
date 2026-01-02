import type { Logger } from "pino";
import type { DownloadStatus } from "@repo/shared-types";
import { DownloadQueueService } from "../../application/services/download-queue.service.js";
import {
  AddToQueueSchema,
  UpdateQueueItemSchema,
} from "../../modules/download-queue/download-queue.schema.js";

/**
 * Download Queue Controller
 * Handles HTTP request/response for download queue endpoints
 * Responsibilities:
 * - Request validation (Zod)
 * - Calling service methods
 * - Error handling
 * - Response formatting
 */
export class DownloadQueueController {
  private downloadQueueService: DownloadQueueService;
  private logger: Logger;

  constructor({
    downloadQueueService,
    logger,
  }: {
    downloadQueueService: DownloadQueueService;
    logger: Logger;
  }) {
    this.downloadQueueService = downloadQueueService;
    this.logger = logger;
  }

  /**
   * List all download queue items
   */
  async list(query: { status?: DownloadStatus }) {
    const items = await this.downloadQueueService.getAllQueueItems(query.status);

    return {
      data: items.map((item) => ({
        ...item,
        status: item.status as DownloadStatus,
      })),
    };
  }

  /**
   * Get download queue item by ID
   */
  async getById(params: { id: string }) {
    const item = await this.downloadQueueService.getQueueItemById(params.id);

    if (!item) {
      throw new Error("Download queue item not found");
    }

    return {
      ...item,
      status: item.status as DownloadStatus,
    };
  }

  /**
   * Add to download queue
   */
  async create(body: unknown) {
    const validated = AddToQueueSchema.parse(body);

    const created = await this.downloadQueueService.addToQueue({
      sceneId: validated.sceneId,
      title: validated.title,
      size: validated.size,
      seeders: validated.seeders,
      quality: validated.quality,
      magnetLink: validated.magnetLink,
    });

    return {
      ...created!,
      status: created!.status as DownloadStatus,
    };
  }

  /**
   * Update download queue item
   */
  async update(params: { id: string }, body: unknown) {
    const validated = UpdateQueueItemSchema.parse(body);

    const updated = await this.downloadQueueService.updateQueueItem(
      params.id,
      validated
    );

    return {
      ...updated!,
      status: updated!.status as DownloadStatus,
    };
  }

  /**
   * Remove from download queue
   */
  async remove(params: { id: string }, query: { deleteTorrent?: boolean }) {
    await this.downloadQueueService.removeFromQueue(
      params.id,
      query.deleteTorrent || false
    );

    return { success: true };
  }

  /**
   * Pause download
   */
  async pause(params: { id: string }) {
    await this.downloadQueueService.pauseDownload(params.id);
    return { success: true };
  }

  /**
   * Resume download
   */
  async resume(params: { id: string }) {
    await this.downloadQueueService.resumeDownload(params.id);
    return { success: true };
  }

  /**
   * Get unified downloads
   */
  async getUnifiedDownloads() {
    const downloads = await this.downloadQueueService.getUnifiedDownloads();
    return { downloads };
  }
}
