import { mkdir, writeFile, readdir, stat, rename, rm, access } from "fs/promises";
import { join, basename, extname, dirname } from "path";
import type { Database } from "@repo/database";
import { eq } from "drizzle-orm";
import { scenes, performers, studios, sceneFiles, sceneExclusions } from "@repo/database";
import { constants } from "fs";
import type { NFOMetadata } from "@repo/shared-types";
import type { QBittorrentService } from "./qbittorrent.service.js";
import { createTorrentParserService } from "./parser.service.js";
import { logger } from "../utils/logger.js";

export class FileManagerService {
  private scenesPath: string;
  private incompletePath: string;

  private db: Database;

  constructor({
    db,
    scenesPath,
    incompletePath,
  }: {
    db: Database;
    scenesPath: string;
    incompletePath: string;
  }) {
    this.db = db;
    this.scenesPath = scenesPath;
    this.incompletePath = incompletePath;
  }

  /**
   * Create folder structure for a scene
   * Format: /scenes/{cleaned_title}/
   * Adds random chars only on collision: /scenes/{cleaned_title} rand/
   */
  async createSceneFolder(sceneId: string): Promise<string> {
    // Get scene with performers and studios
    const scene = await this.getSceneWithMetadata(sceneId);

    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`);
    }

    // Sanitize folder name
    const sanitizedTitle = this.sanitizeFilename(scene.title);

    // Try base path first
    let folderPath = join(this.scenesPath, sanitizedTitle);

    // Check for collision
    const exists = await this.checkFolderExists(folderPath);

    if (exists) {
      // Add random chars on collision (4 alphanumeric characters)
      const randomSuffix = this.generateRandomSuffix(4);
      folderPath = join(this.scenesPath, `${sanitizedTitle} ${randomSuffix}`);

      // Edge case: Check if random suffix also collides (very unlikely)
      const stillExists = await this.checkFolderExists(folderPath);
      if (stillExists) {
        // Use timestamp as ultimate fallback
        const timestamp = Date.now().toString(36).slice(-4);
        folderPath = join(this.scenesPath, `${sanitizedTitle} ${timestamp}`);
      }
    }

    // Create directory recursively
    await mkdir(folderPath, { recursive: true });

    return folderPath;
  }

  /**
   * Check if folder exists
   */
  private async checkFolderExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate random alphanumeric suffix for collision avoidance
   */
  private generateRandomSuffix(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Download poster image for a scene
   */
  async downloadPoster(sceneId: string, folderPath: string): Promise<string | null> {
    const scene = await this.getSceneWithMetadata(sceneId);

    if (!scene || scene.images.length === 0) {
      return null;
    }

    // Get first (primary) image
    const posterUrl = scene.images[0].url;

    try {
      // Download image
      const response = await fetch(posterUrl);
      if (!response.ok) {
        throw new Error(`Failed to download poster: ${response.statusText}`);
      }

      // Determine file extension from URL or content-type
      const contentType = response.headers.get("content-type");
      let extension = "jpg";
      if (contentType?.includes("png")) {
        extension = "png";
      } else if (contentType?.includes("webp")) {
        extension = "webp";
      }

      // Save to folder
      const posterPath = join(folderPath, `poster.${extension}`);
      const buffer = await response.arrayBuffer();
      await writeFile(posterPath, Buffer.from(buffer));

      return posterPath;
    } catch (error) {
      logger.error(`Failed to download poster for scene ${sceneId}:`, error);
      return null;
    }
  }

  /**
   * Generate NFO file for a scene (Kodi/Plex compatible)
   */
  async generateNFO(sceneId: string, folderPath: string): Promise<string> {
    const scene = await this.getSceneWithMetadata(sceneId);

    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`);
    }

    // Generate NFO content (XML format for Kodi)
    const nfoContent = this.buildNFOContent(scene);

    // Save to folder
    const nfoPath = join(folderPath, `${this.sanitizeFilename(scene.title)}.nfo`);
    await writeFile(nfoPath, nfoContent, "utf-8");

    return nfoPath;
  }

  /**
   * Get scene with full metadata (performers, studios)
   */
  private async getSceneWithMetadata(sceneId: string): Promise<NFOMetadata | null> {
    const scene = await this.db.query.scenes.findFirst({
      where: eq(scenes.id, sceneId),
    });

    if (!scene) {
      return null;
    }

    // Get performers for this scene
    const performerRecords = await this.db.query.performersScenes.findMany({
      where: (performersScenes, { eq }) => eq(performersScenes.sceneId, sceneId),
    });

    const performerIds = performerRecords.map((ps) => ps.performerId);
    const performersData = await Promise.all(
      performerIds.map((id) =>
        this.db.query.performers.findFirst({
          where: eq(performers.id, id),
        })
      )
    );

    // Get studio for this scene from siteId
    let studiosData: any[] = [];
    if (scene.siteId) {
      const studio = await this.db.query.studios.findFirst({
        where: eq(studios.id, scene.siteId),
      });
      if (studio) {
        studiosData = [studio];
      }
    }

    return {
      id: scene.id,
      externalIds: scene.externalIds,
      title: scene.title,
      date: scene.date,
      duration: scene.duration,
      code: scene.code,
      url: scene.url,
      images: scene.images as Array<{ url: string; width?: number; height?: number }>,
      performers: performersData
        .filter((p) => p !== undefined)
        .map((p) => ({
          id: p!.id,
          name: p!.name,
        })),
      studios: studiosData
        .filter((s) => s !== undefined)
        .map((s) => ({
          id: s!.id,
          name: s!.name,
        })),
    };
  }

  /**
   * Build NFO XML content (Kodi format)
   */
  private buildNFOContent(scene: NFOMetadata): string {
    const performers = (scene.performers || []).map((p) => `    <actor>\n      <name>${this.escapeXML(p.name)}</name>\n    </actor>`).join("\n");

    const studio = scene.studios[0]?.name || "";

    // Get StashDB ID from externalIds if available
    const stashdbId = scene.externalIds.find((e) => e.source === "stashdb")?.id || null;

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>${this.escapeXML(scene.title)}</title>
  <originaltitle>${this.escapeXML(scene.title)}</originaltitle>
  ${scene.date ? `<premiered>${scene.date}</premiered>` : ""}
  ${scene.date ? `<releasedate>${scene.date}</releasedate>` : ""}
  ${studio ? `<studio>${this.escapeXML(studio)}</studio>` : ""}
  ${scene.code ? `<id>${this.escapeXML(scene.code)}</id>` : ""}
  ${stashdbId ? `<uniqueid type="stashdb">${stashdbId}</uniqueid>` : ""}
  ${scene.duration ? `<runtime>${Math.floor(scene.duration / 60)}</runtime>` : ""}
  ${performers}
</movie>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Sanitize filename by removing invalid characters
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, "") // Remove invalid characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
      .substring(0, 100); // Limit length
  }

  /**
   * Move completed torrent files using qBittorrent API
   * This preserves seeding by letting qBittorrent track the file location
   */
  async moveCompletedTorrentViaQBit(
    sceneId: string,
    qbitHash: string,
    qbittorrent: QBittorrentService
  ): Promise<{
    destinationPath: string;
    nfoPath: string | null;
    posterPath: string | null;
  }> {
    const scene = await this.getSceneWithMetadata(sceneId);
    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`);
    }

    // Use createSceneFolder which handles collision detection automatically
    const destinationFolder = await this.createSceneFolder(sceneId);

    // Use qBittorrent API to move torrent (preserves seeding)
    const success = await qbittorrent.setLocation(qbitHash, destinationFolder);

    if (!success) {
      throw new Error(`Failed to move torrent ${qbitHash} via qBittorrent API`);
    }

    // Wait for qBittorrent to complete the move (poll for confirmation)
    await this.waitForTorrentMove(qbitHash, destinationFolder, qbittorrent);

    // Generate NFO and download poster
    let nfoPath: string | null = null;
    let posterPath: string | null = null;

    try {
      nfoPath = await this.generateNFO(sceneId, destinationFolder);
    } catch (error) {
      logger.error(`Failed to generate NFO for scene ${sceneId}:`, error);
    }

    try {
      posterPath = await this.downloadPoster(sceneId, destinationFolder);
    } catch (error) {
      logger.error(`Failed to download poster for scene ${sceneId}:`, error);
    }

    return {
      destinationPath: destinationFolder,
      nfoPath,
      posterPath,
    };
  }

  /**
   * Wait for qBittorrent to complete file move operation
   * Polls torrent properties until save_path matches expected path
   */
  private async waitForTorrentMove(
    qbitHash: string,
    expectedPath: string,
    qbittorrent: QBittorrentService,
    maxRetries = 10,
    delayMs = 1000
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      const torrentInfo = await qbittorrent.getTorrentProperties(qbitHash);

      // Check if save_path matches expected path
      if (
        torrentInfo.save_path === expectedPath ||
        torrentInfo.content_path.startsWith(expectedPath)
      ) {
        return; // Move completed successfully
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error(
      `Timeout waiting for qBittorrent to move torrent ${qbitHash} to ${expectedPath}`
    );
  }

  /**
   * @deprecated Use moveCompletedTorrentViaQBit instead to preserve seeding
   * Move completed torrent files from incomplete to scenes folder
   */
  async moveCompletedTorrent(
    sceneId: string,
    sourcePath: string
  ): Promise<{
    destinationPath: string;
    nfoPath: string | null;
    posterPath: string | null;
  }> {
    const scene = await this.getSceneWithMetadata(sceneId);
    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`);
    }

    // Build destination path
    const sanitizedTitle = this.sanitizeFilename(scene.title);
    const studioName = scene.studios[0]?.name || "Unknown";
    const sanitizedStudio = this.sanitizeFilename(studioName);

    const destinationFolder = join(this.scenesPath, sanitizedStudio, sanitizedTitle);
    await mkdir(destinationFolder, { recursive: true });

    // Check if source path exists
    try {
      await access(sourcePath, constants.F_OK);
    } catch {
      throw new Error(`Source path does not exist: ${sourcePath}`);
    }

    // Check if source is a file or directory
    const sourceStat = await stat(sourcePath);

    if (sourceStat.isDirectory()) {
      // Move all files from directory
      const files = await readdir(sourcePath);
      for (const file of files) {
        const sourceFile = join(sourcePath, file);
        const destFile = join(destinationFolder, file);
        await rename(sourceFile, destFile);
      }
      // Remove empty source directory
      await rm(sourcePath, { recursive: true, force: true });
    } else {
      // Move single file
      const fileName = basename(sourcePath);
      const destFile = join(destinationFolder, fileName);
      await rename(sourcePath, destFile);
    }

    // Generate NFO and download poster
    let nfoPath: string | null = null;
    let posterPath: string | null = null;

    try {
      nfoPath = await this.generateNFO(sceneId, destinationFolder);
    } catch (error) {
      logger.error(`Failed to generate NFO for scene ${sceneId}:`, error);
    }

    try {
      posterPath = await this.downloadPoster(sceneId, destinationFolder);
    } catch (error) {
      logger.error(`Failed to download poster for scene ${sceneId}:`, error);
    }

    return {
      destinationPath: destinationFolder,
      nfoPath,
      posterPath,
    };
  }

  /**
   * Rename media file based on metadata pattern
   * Pattern: [Studio] Scene Title (YYYY-MM-DD).ext
   */
  async renameMediaFile(sceneId: string, currentPath: string): Promise<string> {
    const scene = await this.getSceneWithMetadata(sceneId);
    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`);
    }

    const extension = extname(currentPath);
    const directory = dirname(currentPath);

    const studioName = scene.studios[0]?.name || "Unknown";
    const dateStr = scene.date || "";

    // Build new filename: [Studio] Title (Date).ext
    let newFileName = `[${studioName}] ${scene.title}`;
    if (dateStr) {
      newFileName += ` (${dateStr})`;
    }
    newFileName = this.sanitizeFilename(newFileName) + extension;

    const newPath = join(directory, newFileName);

    // Only rename if different
    if (currentPath !== newPath) {
      await rename(currentPath, newPath);
    }

    return newPath;
  }

  /**
   * Scan filesystem for missing scenes
   */
  async scanFilesystem(): Promise<{
    missingScenes: Array<{ sceneId: string; expectedPath: string }>;
    orphanedFiles: Array<{ path: string }>;
  }> {
    const missingScenes: Array<{ sceneId: string; expectedPath: string }> = [];

    // Get all scene files from database
    const allSceneFiles = await this.db.query.sceneFiles.findMany();

    // Check each file exists
    for (const sceneFile of allSceneFiles) {
      try {
        await access(sceneFile.filePath, constants.F_OK);
      } catch {
        // File doesn't exist
        missingScenes.push({
          sceneId: sceneFile.sceneId,
          expectedPath: sceneFile.filePath,
        });
      }
    }

    // Detect orphaned files (files on disk not in DB)
    const orphanedFiles: Array<{ path: string }> = [];

    try {
      // Check if scenes directory exists
      await access(this.scenesPath, constants.F_OK);

      // Scan the scenes directory recursively
      const filesOnDisk = await this.scanDirectory(this.scenesPath);

      // Build a Set of known file paths for quick lookup
      const knownPaths = new Set(allSceneFiles.map(sf => sf.filePath));

      // Filter video files that aren't in the database
      const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg'];

      for (const filePath of filesOnDisk) {
        const ext = extname(filePath).toLowerCase();

        // Only check video files
        if (videoExtensions.includes(ext)) {
          if (!knownPaths.has(filePath)) {
            orphanedFiles.push({ path: filePath });
          }
        }
      }
    } catch (error) {
      // If scenes directory doesn't exist or can't be accessed, just log and continue
      logger.error(`Failed to scan scenes directory ${this.scenesPath}:`, error);
    }

    return {
      missingScenes,
      orphanedFiles,
    };
  }

  /**
   * Recursively scan a directory and return all file paths
   */
  private async scanDirectory(dirPath: string): Promise<string[]> {
    const filePaths: string[] = [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subFiles = await this.scanDirectory(fullPath);
          filePaths.push(...subFiles);
        } else if (entry.isFile()) {
          // Add file to list
          filePaths.push(fullPath);
        }
      }
    } catch (error) {
      logger.error(`Failed to scan directory ${dirPath}:`, error);
    }

    return filePaths;
  }

  /**
   * Delete scene folder and add to exclusions
   */
  async deleteSceneFolder(sceneId: string, reason: "user_deleted" | "manual_removal"): Promise<void> {
    // Get scene files
    const files = await this.db.query.sceneFiles.findMany({
      where: eq(sceneFiles.sceneId, sceneId),
    });

    // Delete folder if exists (from scene files)
    const deletedFolders = new Set<string>();
    for (const file of files) {
      const folderPath = dirname(file.filePath);
      if (!deletedFolders.has(folderPath)) {
        try {
          await rm(folderPath, { recursive: true, force: true });
          deletedFolders.add(folderPath);
          logger.info(`[FileManager] Deleted folder: ${folderPath}`);
        } catch (error) {
          logger.error(`[FileManager] Failed to delete folder ${folderPath}:`, error);
        }
      }
    }

    // If no files were found, try to find and delete potential folder based on scene title
    if (files.length === 0) {
      try {
        const scene = await this.db.query.scenes.findFirst({
          where: eq(scenes.id, sceneId),
        });

        if (scene) {
          // Try to find folder by scene title
          const sanitizedTitle = this.sanitizeFilename(scene.title);

          // Check for folder with exact title match
          const potentialFolder = join(this.scenesPath, sanitizedTitle);
          try {
            const exists = await this.checkFolderExists(potentialFolder);
            if (exists) {
              await rm(potentialFolder, { recursive: true, force: true });
              logger.info(`[FileManager] Deleted folder by title: ${potentialFolder}`);
            }
          } catch (error) {
            logger.error(`[FileManager] Failed to delete potential folder ${potentialFolder}:`, error);
          }

          // Also check for folders with random suffixes (collision avoidance)
          // Read scenesPath directory and find folders starting with scene title
          try {
            const entries = await readdir(this.scenesPath, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory() && entry.name.startsWith(sanitizedTitle)) {
                const folderPath = join(this.scenesPath, entry.name);
                try {
                  await rm(folderPath, { recursive: true, force: true });
                  logger.info(`[FileManager] Deleted matching folder: ${folderPath}`);
                } catch (error) {
                  logger.error(`[FileManager] Failed to delete matching folder ${folderPath}:`, error);
                }
              }
            }
          } catch (error) {
            logger.error(`[FileManager] Failed to scan scenes directory:`, error);
          }
        }
      } catch (error) {
        logger.error(`[FileManager] Failed to delete folder for scene ${sceneId}:`, error);
      }
    }

    // Add to exclusions
    await this.db.insert(sceneExclusions).values({
      id: crypto.randomUUID(),
      sceneId,
      reason,
      excludedAt: new Date().toISOString(),
    });

    // Remove scene file records
    await this.db.delete(sceneFiles).where(eq(sceneFiles.sceneId, sceneId));
  }

  /**
   * Create complete scene folder with metadata files (for scenes with full metadata)
   */
  async setupSceneFiles(sceneId: string): Promise<{
    folderPath: string;
    posterPath: string | null;
    nfoPath: string;
  }> {
    // Check if this scene already has a folder
    const existingSceneFile = await this.db.query.sceneFiles.findFirst({
      where: eq(sceneFiles.sceneId, sceneId),
    });

    let folderPath: string;

    if (existingSceneFile) {
      // Use existing folder path
      folderPath = dirname(existingSceneFile.filePath);

      // Verify folder still exists
      const exists = await this.checkFolderExists(folderPath);
      if (!exists) {
        // Folder was deleted, create new one
        folderPath = await this.createSceneFolder(sceneId);
      }
    } else {
      // Create new folder
      folderPath = await this.createSceneFolder(sceneId);
    }

    // Download poster
    const posterPath = await this.downloadPoster(sceneId, folderPath);

    // Generate NFO
    const nfoPath = await this.generateNFO(sceneId, folderPath);

    return {
      folderPath,
      posterPath,
      nfoPath,
    };
  }

  /**
   * Create scene folder with simplified metadata (for scenes without StashDB metadata)
   * Only creates folder and basic NFO with title and performer/studio info
   */
  async setupSceneFilesSimplified(sceneId: string): Promise<{
    folderPath: string;
    nfoPath: string;
  }> {
    // Get scene with performers and studios
    const scene = await this.getSceneWithMetadata(sceneId);

    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`);
    }

    // Use parser service to clean the title (removes quality tags, resolution, etc.)
    const parserService = createTorrentParserService();
    const cleanedTitle = parserService.parseTorrent(scene.title).title;

    // Create folder directly with scene title (no studio subfolder, no ID suffix)
    const sanitizedTitle = this.sanitizeFilename(cleanedTitle);

    const folderPath = join(
      this.scenesPath,
      sanitizedTitle
    );

    await mkdir(folderPath, { recursive: true });

    // Generate simplified NFO content (use cleaned title)
    const performers = scene.performers.map((p) => `    <actor>\n      <name>${this.escapeXML(p.name)}</name>\n    </actor>`).join("\n");
    const studio = scene.studios[0]?.name || "";

    const nfoContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>${this.escapeXML(cleanedTitle)}</title>
  <originaltitle>${this.escapeXML(scene.title)}</originaltitle>
  ${studio ? `<studio>${this.escapeXML(studio)}</studio>` : ""}
  ${performers}
</movie>`;

    // Save NFO file (use cleaned title for filename)
    const nfoPath = join(folderPath, `${this.sanitizeFilename(cleanedTitle)}.nfo`);
    await writeFile(nfoPath, nfoContent, "utf-8");

    return {
      folderPath,
      nfoPath,
    };
  }
}

export function createFileManagerService(
  db: Database,
  scenesPath: string,
  incompletePath: string
): FileManagerService {
  return new FileManagerService({ db, scenesPath, incompletePath });
}
