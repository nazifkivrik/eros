import { readdir, stat } from "fs/promises";
import { join, extname } from "path";
import type { Logger } from "pino";
import { FileSystemError } from "../../../errors/application-errors.js";

/**
 * File System Scanning Service
 * Handles file system operations for scenes (scanning folders, detecting file types)
 */
export class ScenesFilesService {
  private logger: Logger;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
  }

  /**
   * Scan scene folder for specific file types
   * Returns categorized files: NFO, poster, video files
   */
  async scanSceneFolder(sceneFolder: string): Promise<{
    nfoFiles: string[];
    posterFiles: string[];
    videoFiles: string[];
    totalFiles: number;
  }> {
    const result = {
      nfoFiles: [] as string[],
      posterFiles: [] as string[],
      videoFiles: [] as string[],
      totalFiles: 0,
    };

    try {
      const dirExists = await this.directoryExists(sceneFolder);

      if (!dirExists) {
        this.logger.debug({ sceneFolder }, "Scene folder does not exist");
        return result;
      }

      const filesInFolder = await readdir(sceneFolder);

      for (const file of filesInFolder) {
        const ext = extname(file).toLowerCase();

        if (ext === ".nfo") {
          result.nfoFiles.push(file);
        } else if (
          [".jpg", ".jpeg", ".png", ".webp"].includes(ext) &&
          file.toLowerCase().includes("poster")
        ) {
          result.posterFiles.push(file);
        } else if (
          [
            ".mp4",
            ".mkv",
            ".avi",
            ".mov",
            ".wmv",
            ".flv",
            ".m4v",
            ".webm",
          ].includes(ext)
        ) {
          result.videoFiles.push(file);
        }

        result.totalFiles++;
      }

      this.logger.debug(
        {
          sceneFolder,
          nfoFiles: result.nfoFiles.length,
          posterFiles: result.posterFiles.length,
          videoFiles: result.videoFiles.length,
          totalFiles: result.totalFiles,
        },
        "Scene folder scanned"
      );

      return result;
    } catch (error) {
      this.logger.error({ error, sceneFolder }, "Failed to scan scene folder");
      throw new FileSystemError(`Failed to scan scene folder: ${sceneFolder}`);
    }
  }

  /**
   * Generate scene folder path based on scene title and settings
   */
  generateSceneFolderPath(
    scenesPath: string,
    sceneTitle: string
  ): string | null {
    if (!sceneTitle) {
      return null;
    }

    // Sanitize filename (remove invalid characters)
    const sanitizedTitle = sceneTitle.replace(/[/\\?%*:|"<>]/g, "_");
    return join(scenesPath, sanitizedTitle);
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stats = await stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const stats = await stat(path);
      return stats.isFile();
    } catch {
      return false;
    }
  }
}
