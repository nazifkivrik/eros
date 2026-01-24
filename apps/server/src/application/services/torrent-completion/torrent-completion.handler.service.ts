/**
 * Torrent Completion Handler Service
 * Handles all post-download actions when a torrent completes
 *
 * Responsibilities:
 * - Process completed torrents from qBittorrent
 * - Move files to scenes folder
 * - Update scene files metadata
 * - Update download queue status
 */

import type { TorrentsRepository } from "@/infrastructure/repositories/torrents.repository.js";
import type { FileManagerService } from "@/application/services/file-management/file-manager.service.js";
import type { ITorrentClient } from "@/infrastructure/adapters/interfaces/torrent-client.interface.js";
import type { LogsService } from "@/application/services/logs.service.js";
import { logger } from "@/utils/logger.js";

/**
 * Torrent Completion Handler Service
 */
export class TorrentCompletionHandlerService {
  private repository: TorrentsRepository;
  private fileManager: FileManagerService;
  private logsService: LogsService;
  private torrentClient?: ITorrentClient;

  constructor(deps: {
    torrentsRepository: TorrentsRepository;
    fileManagerService: FileManagerService;
    logsService: LogsService;
    torrentClient?: ITorrentClient;
  }) {
    this.repository = deps.torrentsRepository;
    this.fileManager = deps.fileManagerService;
    this.logsService = deps.logsService;
    this.torrentClient = deps.torrentClient;
  }

  /**
   * Handle torrent completion
   * This is called when a torrent reaches 100% completion
   */
  async handleTorrentCompleted(qbitHash: string): Promise<void> {
    try {
      // Check if torrent client is configured
      if (!this.torrentClient) {
        await this.logsService.error(
          "torrent",
          "Torrent client not configured, cannot process completed torrent",
          { qbitHash }
        );
        return;
      }

      // 1. Find download queue item by qbitHash
      const queueItem = await this.repository.findDownloadQueueItemByHash(qbitHash);

      if (!queueItem) {
        await this.logsService.warning(
          "torrent",
          `No download queue item found for qBit hash: ${qbitHash}`,
          { qbitHash }
        );
        return;
      }

      // 2. Get torrent info from torrent client
      const torrentInfo = await this.torrentClient.getTorrentProperties(qbitHash);

      if (!torrentInfo) {
        await this.logsService.error(
          "torrent",
          `Failed to get torrent info from torrent client for hash: ${qbitHash}`,
          { qbitHash, sceneId: queueItem.sceneId }
        );
        return;
      }

      // 3. Get torrent save path (where torrent client downloaded files)
      const sourcePath = torrentInfo.save_path || torrentInfo.content_path;

      if (!sourcePath) {
        await this.logsService.error(
          "torrent",
          "No save path found in torrent info",
          { qbitHash, sceneId: queueItem.sceneId }
        );
        return;
      }

      await this.logsService.info(
        "torrent",
        `Processing completed torrent for scene: ${queueItem.sceneId}`,
        {
          qbitHash,
          sceneId: queueItem.sceneId,
          sourcePath,
          currentStatus: queueItem.status,
        }
      );

      // 4. Move files to scenes folder and generate metadata using torrent client API
      // This preserves seeding by letting torrent client track the file location
      await this.logsService.info(
        "torrent",
        `Calling moveCompletedTorrentViaClient for scene: ${queueItem.sceneId}`,
        { qbitHash, sceneId: queueItem.sceneId }
      );

      const moveResult = await this.fileManager.moveCompletedTorrentViaQBit(
        queueItem.sceneId,
        qbitHash,
        // Type cast needed as fileManager still expects QBittorrentService
        this.torrentClient as any
      );

      await this.logsService.info(
        "torrent",
        `moveCompletedTorrentViaClient succeeded for scene: ${queueItem.sceneId}`,
        {
          qbitHash,
          sceneId: queueItem.sceneId,
          destinationPath: moveResult.destinationPath
        }
      );

      await this.logsService.info(
        "torrent",
        `Files moved to: ${moveResult.destinationPath}`,
        {
          sceneId: queueItem.sceneId,
          destinationPath: moveResult.destinationPath,
          nfoGenerated: !!moveResult.nfoPath,
          posterDownloaded: !!moveResult.posterPath,
        }
      );

      // 5. Update sceneFiles table with new paths
      const mediaFilePath = await this.findMediaFile(moveResult.destinationPath);

      await this.repository.upsertSceneFileFromCompletion({
        sceneId: queueItem.sceneId,
        filePath: mediaFilePath,
        size: queueItem.size,
        quality: queueItem.quality,
        destinationPath: moveResult.destinationPath,
        nfoPath: moveResult.nfoPath,
        posterPath: moveResult.posterPath,
      });

      // 6. Update download queue status to 'completed'
      await this.repository.updateDownloadQueueStatus(queueItem.id, "completed");

      await this.logsService.info(
        "torrent",
        `Successfully processed completed torrent for scene: ${queueItem.sceneId}`,
        {
          sceneId: queueItem.sceneId,
          qbitHash,
          destinationPath: moveResult.destinationPath,
        }
      );
    } catch (error) {
      await this.logsService.error(
        "torrent",
        `Error processing completed torrent: ${error instanceof Error ? error.message : String(error)}`,
        {
          qbitHash,
          error: error instanceof Error ? error.stack : String(error),
        }
      );
      throw error;
    }
  }

  /**
   * Find the main media file in a directory
   * Looks for common video extensions and returns the largest video file
   */
  private async findMediaFile(directoryPath: string): Promise<string | null> {
    try {
      const { readdir, stat } = await import("fs/promises");
      const { join } = await import("path");

      const files = await readdir(directoryPath);
      const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".m4v", ".webm"];

      // Find largest video file
      let largestFile: { path: string; size: number } | null = null;

      for (const file of files) {
        const filePath = join(directoryPath, file);
        const fileStat = await stat(filePath);

        if (fileStat.isFile()) {
          const extension = file.toLowerCase().slice(file.lastIndexOf("."));
          if (videoExtensions.includes(extension)) {
            if (!largestFile || fileStat.size > largestFile.size) {
              largestFile = { path: filePath, size: fileStat.size };
            }
          }
        }
      }

      return largestFile?.path || null;
    } catch (error) {
      logger.error({ error, directoryPath }, "Error finding media file");
      return null;
    }
  }
}
