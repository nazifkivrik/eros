/**
 * Torrent Completion Service
 * Handles all post-download actions when a torrent completes
 */

import type { Database } from "@repo/database";
import { downloadQueue, sceneFiles } from "@repo/database";
import { eq } from "drizzle-orm";
import type { FileManagerService } from "./file-manager.service.js";
import type { QBittorrentService } from "./qbittorrent.service.js";
import type { LogsService } from "./logs.service.js";
import { logger } from "../utils/logger.js";

export class TorrentCompletionService {
  private db: Database;
  private fileManager: FileManagerService;
  private logsService: LogsService;
  private qbittorrent?: QBittorrentService;

  constructor({
    db,
    fileManagerService,
    logsService,
    qbittorrent,
  }: {
    db: Database;
    fileManagerService: FileManagerService;
    logsService: LogsService;
    qbittorrent?: QBittorrentService;
  }) {
    this.db = db;
    this.fileManager = fileManagerService;
    this.logsService = logsService;
    this.qbittorrent = qbittorrent;
  }

  /**
   * Handle torrent completion
   * This is called when a torrent reaches 100% completion
   */
  async handleTorrentCompleted(qbitHash: string): Promise<void> {
    try {
      // Check if qBittorrent is configured
      if (!this.qbittorrent) {
        await this.logsService.error(
          "torrent",
          "qBittorrent not configured, cannot process completed torrent",
          { qbitHash }
        );
        return;
      }

      // 1. Find download queue item by qbitHash
      const queueItem = await this.db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.qbitHash, qbitHash),
      });

      if (!queueItem) {
        await this.logsService.warning(
          "torrent",
          `No download queue item found for qBit hash: ${qbitHash}`,
          { qbitHash }
        );
        return;
      }

      // 2. Get torrent info from qBittorrent
      const torrentInfo = await this.qbittorrent.getTorrentProperties(qbitHash);

      if (!torrentInfo) {
        await this.logsService.error(
          "torrent",
          `Failed to get torrent info from qBittorrent for hash: ${qbitHash}`,
          { qbitHash, sceneId: queueItem.sceneId },
          { sceneId: queueItem.sceneId }
        );
        return;
      }

      // 3. Get torrent save path (where qBittorrent downloaded files)
      const sourcePath = torrentInfo.save_path || torrentInfo.content_path;

      if (!sourcePath) {
        await this.logsService.error(
          "torrent",
          "No save path found in torrent info",
          { qbitHash, sceneId: queueItem.sceneId },
          { sceneId: queueItem.sceneId }
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
        },
        { sceneId: queueItem.sceneId }
      );

      // 4. Move files to scenes folder and generate metadata using qBittorrent API
      // This preserves seeding by letting qBittorrent track the file location
      await this.logsService.info(
        "torrent",
        `Calling moveCompletedTorrentViaQBit for scene: ${queueItem.sceneId}`,
        { qbitHash, sceneId: queueItem.sceneId },
        { sceneId: queueItem.sceneId }
      );

      const moveResult = await this.fileManager.moveCompletedTorrentViaQBit(
        queueItem.sceneId,
        qbitHash,
        this.qbittorrent
      );

      await this.logsService.info(
        "torrent",
        `moveCompletedTorrentViaQBit succeeded for scene: ${queueItem.sceneId}`,
        {
          qbitHash,
          sceneId: queueItem.sceneId,
          destinationPath: moveResult.destinationPath
        },
        { sceneId: queueItem.sceneId }
      );

      await this.logsService.info(
        "torrent",
        `Files moved to: ${moveResult.destinationPath}`,
        {
          sceneId: queueItem.sceneId,
          destinationPath: moveResult.destinationPath,
          nfoGenerated: !!moveResult.nfoPath,
          posterDownloaded: !!moveResult.posterPath,
        },
        { sceneId: queueItem.sceneId }
      );

      // 5. Update sceneFiles table with new paths
      // First, check if scene file record exists
      const existingSceneFile = await this.db.query.sceneFiles.findFirst({
        where: eq(sceneFiles.sceneId, queueItem.sceneId),
      });

      // Get the actual media file path (find video file in destination)
      const mediaFilePath = await this.findMediaFile(moveResult.destinationPath);

      if (existingSceneFile) {
        // Update existing record
        await this.db
          .update(sceneFiles)
          .set({
            filePath: mediaFilePath || existingSceneFile.filePath,
            nfoPath: moveResult.nfoPath,
            posterPath: moveResult.posterPath,
          })
          .where(eq(sceneFiles.id, existingSceneFile.id));
      } else {
        // Create new record
        if (mediaFilePath) {
          await this.db.insert(sceneFiles).values({
            id: crypto.randomUUID(),
            sceneId: queueItem.sceneId,
            filePath: mediaFilePath,
            size: queueItem.size,
            quality: queueItem.quality,
            relativePath: mediaFilePath.replace(moveResult.destinationPath, ""),
            nfoPath: moveResult.nfoPath,
            posterPath: moveResult.posterPath,
          });
        }
      }

      // 6. Update download queue status to 'completed'
      await this.db
        .update(downloadQueue)
        .set({
          status: "completed",
          completedAt: new Date().toISOString(),
        })
        .where(eq(downloadQueue.id, queueItem.id));

      await this.logsService.info(
        "torrent",
        `Successfully processed completed torrent for scene: ${queueItem.sceneId}`,
        {
          sceneId: queueItem.sceneId,
          qbitHash,
          destinationPath: moveResult.destinationPath,
        },
        { sceneId: queueItem.sceneId }
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
   * Looks for common video extensions
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

export function createTorrentCompletionService(
  db: Database,
  fileManager: FileManagerService,
  logsService: LogsService,
  qbittorrent?: QBittorrentService
): TorrentCompletionService {
  return new TorrentCompletionService({
    db,
    fileManagerService: fileManager,
    logsService,
    qbittorrent,
  });
}
