import { mkdir, writeFile, readdir, stat, rename, rm, access } from "fs/promises";
import { join, basename, extname, dirname } from "path";
import type { Database } from "@repo/database";
import { eq } from "drizzle-orm";
import { scenes, performers, studios, sceneFiles, sceneExclusions } from "@repo/database";
import { constants } from "fs";
import type { NFOMetadata } from "@repo/shared-types";
import type { ITorrentClient } from "@/infrastructure/adapters/interfaces/torrent-client.interface.js";
import { createTorrentParserService } from "@/application/services/torrent-quality/parser.service.js";
import { logger } from "@/utils/logger.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Minimum 5GB free space required
const MIN_FREE_SPACE_BYTES = 5 * 1024 * 1024 * 1024;

export class FileManagerService {
  private scenesPath: string;
  private incompletePath: string;
  private settingsRepository: any; // SettingsRepository

  private db: Database;

  constructor({
    db,
    scenesPath,
    incompletePath,
    settingsRepository,
  }: {
    db: Database;
    scenesPath: string;
    incompletePath: string;
    settingsRepository?: any;
  }) {
    this.db = db;
    this.scenesPath = scenesPath;
    this.incompletePath = incompletePath;
    this.settingsRepository = settingsRepository;
  }

  /**
   * Get the optimal download path based on available space
   * Selects the path with the most free space (above 5GB minimum)
   * Settings paths should be full paths like /app/1tb or /app/1tb/media/scenes
   */
  private async getOptimalDownloadPath(): Promise<string> {
    // If no settings repository, use default scenesPath
    if (!this.settingsRepository) {
      return this.scenesPath;
    }

    try {
      const settings = await this.settingsRepository.getSettings();
      const downloadPaths = settings.downloadPaths?.paths || [];

      // If no download paths configured, use default
      if (downloadPaths.length === 0) {
        return this.scenesPath;
      }

      // Get disk space info for each path
      const pathSpaceInfos: Array<{ path: string; freeBytes: number; name: string }> = [];

      for (const dp of downloadPaths) {
        if (!dp.path) continue;

        try {
          // Get disk stats using df command
          // Use the path as-is from settings, user should configure full path
          const { stdout } = await execAsync(`LC_ALL=C df -B1 "${dp.path}" 2>/dev/null`);
          const lines = stdout.trim().split("\n");

          if (lines.length < 2) continue;

          const data = lines[1]?.split(/\s+/);
          if (!data || data.length < 4) continue;

          const available = parseInt(data[3], 10);

          pathSpaceInfos.push({
            path: dp.path,
            freeBytes: available,
            name: dp.name || dp.path,
          });

          logger.debug({
            path: dp.path,
            availableBytes: available,
            availableGB: (available / 1024 / 1024 / 1024).toFixed(2),
          }, "[FileManager] Disk space info");
        } catch (error) {
          logger.warn({ path: dp.path, error }, "[FileManager] Failed to get disk space for path");
        }
      }

      // Also check the default scenesPath
      // Extract base path from scenesPath (e.g., /app/media/scenes -> /app/media)
      const defaultBasePath = this.scenesPath.split('/media')[0] || this.scenesPath.split('/').slice(0, 2).join('/');
      try {
        const { stdout } = await execAsync(`LC_ALL=C df -B1 "${defaultBasePath}" 2>/dev/null`);
        const lines = stdout.trim().split("\n");

        if (lines.length >= 2) {
          const data = lines[1]?.split(/\s+/);
          if (data && data.length >= 4) {
            const available = parseInt(data[3], 10);
            pathSpaceInfos.push({
              path: this.scenesPath,
              freeBytes: available,
              name: "Default Scenes Path",
            });
          }
        }
      } catch (error) {
        logger.warn({ path: this.scenesPath, error }, "[FileManager] Failed to get disk space for default path");
      }

      // Filter paths with at least 5GB free space
      const viablePaths = pathSpaceInfos.filter(p => p.freeBytes >= MIN_FREE_SPACE_BYTES);

      if (viablePaths.length === 0) {
        logger.warn(
          { pathSpaceInfos: pathSpaceInfos.map(p => ({ path: p.path, freeGB: (p.freeBytes / 1024 / 1024 / 1024).toFixed(2) })) },
          "[FileManager] No paths with 5GB+ free space, using default"
        );
        return this.scenesPath;
      }

      // Sort by free space descending and pick the best
      viablePaths.sort((a, b) => b.freeBytes - a.freeBytes);
      const selected = viablePaths[0];

      // Ensure the directory exists (user should configure full path in settings)
      // If path doesn't end with /media/scenes, append it for backwards compatibility
      let finalPath = selected.path;

      // Only append /media/scenes if path is a base disk path (doesn't contain /media)
      // This maintains backwards compatibility while allowing full path configuration
      if (!finalPath.includes('/media')) {
        finalPath = join(finalPath, 'media', 'scenes');
      } else if (!finalPath.includes('/scenes')) {
        // Path has /media but not /scenes, append /scenes
        finalPath = join(finalPath, 'scenes');
      }

      // Ensure the directory exists
      await mkdir(finalPath, { recursive: true });

      logger.info({
        originalPath: selected.path,
        finalPath,
        selectedName: selected.name,
        freeGB: (selected.freeBytes / 1024 / 1024 / 1024).toFixed(2),
        totalViablePaths: viablePaths.length,
      }, "[FileManager] Selected optimal download path");

      return finalPath;
    } catch (error) {
      logger.error({ error }, "[FileManager] Error getting optimal download path, using default");
      return this.scenesPath;
    }
  }

  /**
   * Create folder structure for a scene
   * Format: /scenes/{cleaned_title}/
   * Adds random chars only on collision: /scenes/{cleaned_title} rand/
   *
   * IMPORTANT: If scene already has files in database, reuses the existing folder
   */
  async createSceneFolder(sceneId: string): Promise<string> {
    // First, check if this scene already has files in the database
    // If so, reuse the existing folder to avoid duplicates
    const existingSceneFile = await this.db.query.sceneFiles.findFirst({
      where: (sceneFiles, { eq }) => eq(sceneFiles.sceneId, sceneId),
    });

    if (existingSceneFile) {
      // Extract folder path from existing file path
      const { dirname } = await import("path");
      const existingFolder = dirname(existingSceneFile.filePath);

      // Verify folder still exists on disk
      const folderExists = await this.checkFolderExists(existingFolder);
      if (folderExists) {
        logger.info({
          sceneId,
          existingFolder,
          existingFilePath: existingSceneFile.filePath,
        }, "[FileManager] Reusing existing scene folder");
        return existingFolder;
      } else {
        logger.warn({
          sceneId,
          existingFolder,
        }, "[FileManager] Existing scene folder not found on disk, creating new one");
      }
    }

    // Get scene with performers and studios
    const scene = await this.getSceneWithMetadata(sceneId);

    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`);
    }

    // Sanitize folder name
    const sanitizedTitle = this.sanitizeFilename(scene.title);

    // NEW: Check filesystem for existing folders with same/similar title
    const scenesPath = await this.getOptimalDownloadPath();

    const existingFolder = await this.findExistingFolderByTitle(sanitizedTitle, scenesPath);
    if (existingFolder) {
      logger.info(
        { sceneId, existingFolder },
        "[FileManager] Found existing folder on filesystem, reusing it"
      );
      return existingFolder;
    }

    // Try base path first
    let folderPath = join(scenesPath, sanitizedTitle);

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
   * Find existing folder on filesystem by scene title
   * Checks for exact match or match with random suffix pattern
   * Returns folder path if found, null otherwise
   */
  private async findExistingFolderByTitle(title: string, searchPath: string): Promise<string | null> {
    try {
      const entries = await readdir(searchPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const folderName = entry.name;

        // Check for exact match
        if (folderName === title) {
          const fullPath = join(searchPath, folderName);
          return fullPath;
        }

        // Check for match with random suffix pattern (title + space + 4 chars)
        // Pattern: "Scene Title xyz1"
        if (folderName.startsWith(title) && folderName.length > title.length + 1) {
          const suffix = folderName.slice(title.length + 1);
          // Match 4 character alphanumeric suffix (our random suffix pattern)
          if (/^[a-z0-9]{4}$/i.test(suffix)) {
            const fullPath = join(searchPath, folderName);
            logger.debug(
              { title, folderName, fullPath },
              "[FileManager] Found folder with matching title and suffix"
            );
            return fullPath;
          }
        }
      }

      return null;
    } catch (error) {
      logger.warn({ error, title }, "[FileManager] Error scanning filesystem for existing folders");
      return null;
    }
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
      logger.error({ error }, `Failed to download poster for scene ${sceneId}:`);
      return null;
    }
  }

  /**
   * Generate NFO file for a scene (Jellyfin/Kodi/Plex compatible)
   * @param sceneId - Scene ID
   * @param folderPath - Folder path where NFO will be saved
   * @param videoFilename - Optional video filename to match NFO name (Jellyfin requires matching names)
   */
  async generateNFO(sceneId: string, folderPath: string, videoFilename?: string): Promise<string> {
    const scene = await this.getSceneWithMetadata(sceneId);

    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`);
    }

    // Generate NFO content (XML format for Jellyfin/Kodi)
    const nfoContent = this.buildNFOContent(scene);

    // Determine NFO filename
    // If videoFilename is provided, use it (Jellyfin requires NFO to match video filename)
    // Use movie.nfo as filename (Jellyfin standard)
    const nfoFilename = 'movie.nfo';

    const nfoPath = join(folderPath, nfoFilename);
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

    // Build tags from various sources
    const tags: string[] = ["Adult Content"];
    if (scene.contentType) {
      tags.push(scene.contentType === "jav" ? "JAV" : scene.contentType.toUpperCase());
    }

    return {
      id: scene.id,
      externalIds: scene.externalIds,
      title: scene.title,
      description: scene.description || null,
      date: scene.date,
      duration: scene.duration,
      code: scene.code,
      url: scene.url,
      trailer: scene.trailer || null,
      rating: scene.rating || null,
      contentType: scene.contentType || null,
      images: scene.images as Array<{ url: string; width?: number; height?: number }>,
      poster: scene.poster || null,
      thumbnail: scene.thumbnail || null,
      performers: performersData
        .filter((p) => p !== undefined)
        .map((p) => ({
          id: p!.id,
          name: p!.name,
          thumbnail: p!.thumbnail || null,
          images: p!.images as Array<{ url: string; width?: number; height?: number }>,
          nationality: p!.nationality || null,
          gender: p!.gender || null,
        })),
      studios: studiosData
        .filter((s) => s !== undefined)
        .map((s) => ({
          id: s!.id,
          name: s!.name,
        })),
      tags,
      director: null, // Could be added from scene metadata if available
    };
  }

  /**
   * Build NFO XML content (Jellyfin/Kodi format with adult content support)
   */
  private buildNFOContent(scene: NFOMetadata): string {
    // Build actors list with thumbnails, images, and profile info
    const performers = (scene.performers || []).map((p) => {
      const name = this.escapeXML(p.name);
      const thumb = p.thumbnail || p.images?.[0]?.url || null;
      const thumbTag = thumb ? `\n    <thumb>${this.escapeXML(thumb)}</thumb>` : "";

      return `  <actor>
    <name>${name}</name>
    <type>Actor</type>${thumbTag}
  </actor>`;
    }).join("\n");

    const studio = scene.studios[0]?.name || "";

    // Extract year from date (format: YYYY-MM-DD)
    let year = "";
    if (scene.date) {
      const dateMatch = scene.date.match(/^(\d{4})/);
      if (dateMatch) {
        year = dateMatch[1];
      }
    }

    // Extract external IDs
    const stashdbId = scene.externalIds?.find((e) => e.source === "stashdb")?.id || null;
    const tpdbId = scene.externalIds?.find((e) => e.source === "tpdb")?.id || null;

    // Build genre tags (multiple allowed)
    const genreTags: string[] = ["Adult"];
    if (scene.contentType) {
      if (scene.contentType === "jav") {
        genreTags.push("JAV");
        genreTags.push("Asian");
      } else if (scene.contentType === "movie") {
        genreTags.push("Movie");
      } else {
        genreTags.push("Scene");
      }
    }
    if (studio) {
      genreTags.push(studio);
    }
    const genres = genreTags.map(g => `  <genre>${this.escapeXML(g)}</genre>`).join("\n");

    // Build style tags based on performer attributes
    const styleTags: string[] = [];
    scene.performers?.forEach(p => {
      if (p.gender) {
        const genderTag = p.gender.charAt(0).toUpperCase() + p.gender.slice(1);
        if (!styleTags.includes(genderTag)) {
          styleTags.push(genderTag);
        }
      }
      if (p.nationality) {
        if (!styleTags.includes(p.nationality)) {
          styleTags.push(p.nationality);
        }
      }
    });
    const styles = styleTags.length > 0
      ? "\n" + styleTags.map(s => `  <style>${this.escapeXML(s)}</style>`).join("\n")
      : "";

    // Build tags (multiple allowed)
    const tagElements = scene.tags.map(t => `  <tag>${this.escapeXML(t)}</tag>`).join("\n");

    // Build trailer in Kodi format if available
    let trailerTag = "";
    if (scene.trailer) {
      // Convert YouTube URL to Kodi format if needed
      let youtubeId = null;
      const youtubeMatch = scene.trailer.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (youtubeMatch) {
        youtubeId = youtubeMatch[1];
        trailerTag = `\n  <trailer>plugin://plugin.video.youtube/?action=play_video&videoid=${youtubeId}</trailer>`;
      } else {
        trailerTag = `\n  <trailer>${this.escapeXML(scene.trailer)}</trailer>`;
      }
    }

    // Build art section if poster or thumbnail available
    let artTag = "";
    if (scene.poster || scene.thumbnail) {
      const posterPath = scene.poster || scene.thumbnail;
      artTag = `\n  <art>\n    <poster>${this.escapeXML(posterPath!)}</poster>\n  </art>`;
    }

    // Generate NFO with Jellyfin-compatible structure
    return `<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <title>${this.escapeXML(scene.title)}</title>
  <originaltitle>${this.escapeXML(scene.title)}</originaltitle>
  ${year ? `<year>${year}</year>` : ""}
  ${scene.date ? `<premiered>${scene.date}</premiered>` : ""}
  ${scene.date ? `<releasedate>${scene.date}</releasedate>` : ""}
  ${scene.description ? `<plot>${this.escapeXML(scene.description)}</plot>` : ""}
  ${scene.code ? `<id>${this.escapeXML(scene.code)}</id>` : ""}
  ${studio ? `<studio>${this.escapeXML(studio)}</studio>` : ""}
  ${scene.duration ? `<runtime>${Math.floor(scene.duration / 60)}</runtime>` : ""}
  ${scene.rating && scene.rating > 0 ? `<rating>${scene.rating}</rating>` : ""}${trailerTag}${artTag}
  ${stashdbId ? `<uniqueid type="stashdb" default="true">${stashdbId}</uniqueid>` : ""}
  ${tpdbId ? `<uniqueid type="tpdb" default="false">${tpdbId}</uniqueid>` : ""}
${genres}
${tagElements}${styles}
  <mpaa>XXX</mpaa>
  <lockdata>false</lockdata>
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
   * Find and rename video file to clean scene title
   * Removes release group tags, quality info, etc. from filename
   * Pattern: Scene Title (YYYY-MM-DD).ext
   */
  async renameVideoFileToCleanName(
    sceneId: string,
    directoryPath: string
  ): Promise<string | null> {
    try {
      const scene = await this.getSceneWithMetadata(sceneId);
      if (!scene) {
        return null;
      }

      // Find video file in directory
      const files = await readdir(directoryPath);
      const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".m4v", ".webm"];

      let videoFile: string | null = null;
      let videoExt: string = "";

      for (const file of files) {
        const ext = extname(file).toLowerCase();
        if (videoExtensions.includes(ext)) {
          // Skip NFO and image files
          if (!file.toLowerCase().endsWith(".nfo") &&
              !file.toLowerCase().endsWith(".jpg") &&
              !file.toLowerCase().endsWith(".png") &&
              !file.toLowerCase().endsWith(".webp")) {
            videoFile = file;
            videoExt = ext;
            break;
          }
        }
      }

      if (!videoFile) {
        return null;
      }

      // Build clean filename: Scene Title (Date).ext
      const cleanTitle = this.sanitizeFilename(scene.title);
      let newFileName = cleanTitle;

      // Add date suffix if available
      if (scene.date) {
        newFileName += ` (${scene.date})`;
      }

      newFileName += videoExt;

      const oldPath = join(directoryPath, videoFile);
      const newPath = join(directoryPath, newFileName);

      // Only rename if different
      if (oldPath !== newPath) {
        await rename(oldPath, newPath);
        logger.info({
          oldName: videoFile,
          newName: newFileName,
          sceneId,
        }, "[FileManager] Renamed video file to clean format");
      }

      return newPath;
    } catch (error) {
      logger.error({ error, sceneId, directoryPath }, "[FileManager] Failed to rename video file");
      return null;
    }
  }

  /**
   * Move completed torrent files using qBittorrent API
   * This preserves seeding by letting qBittorrent track the file location
   *
   * IMPORTANT: Checks if destination has enough space before moving.
   * If not, finds an alternative disk and moves the folder there first.
   */
  async moveCompletedTorrentViaQBit(
    sceneId: string,
    qbitHash: string,
    qbittorrent: ITorrentClient
  ): Promise<{
    destinationPath: string;
    nfoPath: string | null;
    posterPath: string | null;
  }> {
    const scene = await this.getSceneWithMetadata(sceneId);
    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`);
    }

    // Get torrent size to check if we have enough space
    const torrentProps = await qbittorrent.getTorrentProperties(qbitHash);
    const torrentSize = torrentProps.size || 0;

    // Use createSceneFolder which handles collision detection and optimal disk selection
    let destinationFolder = await this.createSceneFolder(sceneId);

    // Check if destination has enough space (at least 5GB + torrent size buffer)
    const destinationHasSpace = await this.checkDiskSpace(destinationFolder, torrentSize);

    if (!destinationHasSpace) {
      logger.warn({
        sceneId,
        destinationFolder,
        torrentSize,
      }, "[FileManager] Destination folder does not have enough space, finding alternative disk");

      // Find an alternative disk with enough space
      const alternativePath = await this.findAlternativeDiskWithSpace(torrentSize);

      if (!alternativePath) {
        throw new Error(
          `No disk with sufficient space available for scene ${sceneId}. ` +
          `Required: ${Math.ceil(torrentSize / 1024 / 1024 / 1024)}GB + 5GB buffer`
        );
      }

      // Move existing folder to alternative disk
      const sanitizedTitle = this.sanitizeFilename(scene.title);
      const newDestinationFolder = join(alternativePath, sanitizedTitle);

      // Check if folder exists and move it
      const folderExists = await this.checkFolderExists(destinationFolder);
      if (folderExists) {
        logger.info({
          oldPath: destinationFolder,
          newPath: newDestinationFolder,
        }, "[FileManager] Moving existing folder to alternative disk");

        await this.moveFolderToAlternativeDisk(destinationFolder, newDestinationFolder);
      }

      destinationFolder = newDestinationFolder;
      logger.info({
        sceneId,
        newDestination: destinationFolder,
      }, "[FileManager] Using alternative disk with sufficient space");
    }

    logger.info({
      sceneId,
      qbitHash,
      destinationFolder,
      torrentSize,
    }, "[FileManager] About to call setLocation");

    // Get current torrent properties for debugging
    const currentProps = await qbittorrent.getTorrentProperties(qbitHash);
    logger.info({
      qbitHash,
      currentSavePath: currentProps.savePath,
      currentContentPath: currentProps.contentPath,
      destinationFolder,
    }, "[FileManager] Current torrent location");

    // Use qBittorrent API to move torrent (preserves seeding)
    const success = await qbittorrent.setLocation(qbitHash, destinationFolder);

    logger.info({
      qbitHash,
      destinationFolder,
      success,
    }, "[FileManager] setLocation result");

    if (!success) {
      throw new Error(`Failed to move torrent ${qbitHash} via qBittorrent API. Destination: ${destinationFolder}, Current save path: ${currentProps.savePath}`);
    }

    // Wait for qBittorrent to complete the move (poll for confirmation)
    await this.waitForTorrentMove(qbitHash, destinationFolder, qbittorrent);

    // Rename video file to clean format (remove release group tags, quality info, etc.)
    const renamedFilePath = await this.renameVideoFileToCleanName(sceneId, destinationFolder);
    logger.info({
      sceneId,
      renamedFilePath,
    }, "[FileManager] Renamed video file to clean format");

    // Generate NFO and download poster
    let nfoPath: string | null = null;
    let posterPath: string | null = null;

    try {
      nfoPath = await this.generateNFO(sceneId, destinationFolder);
    } catch (error) {
      logger.error({ error }, `Failed to generate NFO for scene ${sceneId}:`);
    }

    try {
      posterPath = await this.downloadPoster(sceneId, destinationFolder);
    } catch (error) {
      logger.error({ error }, `Failed to download poster for scene ${sceneId}:`);
    }

    return {
      destinationPath: destinationFolder,
      nfoPath,
      posterPath,
    };
  }

  /**
   * Check if a disk path has at least 5GB + required bytes of free space
   */
  private async checkDiskSpace(folderPath: string, requiredBytes: number): Promise<boolean> {
    try {
      // Get the mount point for the folder
      const { stdout } = await execAsync(`LC_ALL=C df -B1 "${folderPath}" 2>/dev/null`);
      const lines = stdout.trim().split("\n");

      if (lines.length < 2) return false;

      const data = lines[1]?.split(/\s+/);
      if (!data || data.length < 4) return false;

      const available = parseInt(data[3], 10);
      const requiredSpace = MIN_FREE_SPACE_BYTES + requiredBytes;

      return available >= requiredSpace;
    } catch (error) {
      logger.warn({ error, folderPath }, "[FileManager] Failed to check disk space");
      return false;
    }
  }

  /**
   * Find an alternative disk with sufficient space
   * Returns the path with most free space that has at least 5GB + required bytes
   * The returned path will have /media/scenes appended automatically
   */
  private async findAlternativeDiskWithSpace(requiredBytes: number): Promise<string | null> {
    if (!this.settingsRepository) {
      return null;
    }

    try {
      const settings = await this.settingsRepository.getSettings();
      const downloadPaths = settings.downloadPaths?.paths || [];

      // Get disk space info for each path
      const pathSpaceInfos: Array<{ path: string; freeBytes: number; name: string }> = [];

      for (const dp of downloadPaths) {
        if (!dp.path) continue;

        try {
          const { stdout } = await execAsync(`LC_ALL=C df -B1 "${dp.path}" 2>/dev/null`);
          const lines = stdout.trim().split("\n");

          if (lines.length < 2) continue;

          const data = lines[1]?.split(/\s+/);
          if (!data || data.length < 4) continue;

          const available = parseInt(data[3], 10);
          const requiredSpace = MIN_FREE_SPACE_BYTES + requiredBytes;

          if (available >= requiredSpace) {
            pathSpaceInfos.push({
              path: dp.path,
              freeBytes: available,
              name: dp.name || dp.path,
            });
          }
        } catch (error) {
          logger.warn({ path: dp.path, error }, "[FileManager] Failed to check disk space for path");
        }
      }

      if (pathSpaceInfos.length === 0) {
        return null;
      }

      // Sort by free space descending and pick the best
      pathSpaceInfos.sort((a, b) => b.freeBytes - a.freeBytes);

      const selected = pathSpaceInfos[0];

      // Ensure the path has /media/scenes structure
      let finalPath = selected.path;
      if (!finalPath.includes('/media')) {
        finalPath = join(finalPath, 'media', 'scenes');
      } else if (!finalPath.includes('/scenes')) {
        finalPath = join(finalPath, 'scenes');
      }

      // Ensure the directory exists
      await mkdir(finalPath, { recursive: true });

      logger.info({
        originalPath: selected.path,
        finalPath,
        selectedName: selected.name,
        freeGB: (selected.freeBytes / 1024 / 1024 / 1024).toFixed(2),
        requiredGB: (requiredBytes / 1024 / 1024 / 1024).toFixed(2),
      }, "[FileManager] Selected alternative disk");

      return finalPath;
    } catch (error) {
      logger.error({ error }, "[FileManager] Error finding alternative disk");
      return null;
    }
  }

  /**
   * Move a folder from one disk to another while preserving structure
   */
  private async moveFolderToAlternativeDisk(sourcePath: string, targetPath: string): Promise<void> {
    try {
      // Create target directory
      await mkdir(targetPath, { recursive: true });

      // Copy all files from source to target
      const entries = await readdir(sourcePath, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = join(sourcePath, entry.name);
        const destPath = join(targetPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively copy subdirectories
          await this.moveFolderToAlternativeDisk(srcPath, destPath);
        } else {
          // Copy file
          const { copyFile } = await import("fs/promises");
          await copyFile(srcPath, destPath);
        }
      }

      // Verify all files copied successfully, then delete source
      const targetEntries = await readdir(targetPath, { withFileTypes: true });
      const sourceEntries = await readdir(sourcePath, { withFileTypes: true });

      if (targetEntries.length >= sourceEntries.length) {
        await rm(sourcePath, { recursive: true, force: true });
        logger.info({
          sourcePath,
          targetPath,
        }, "[FileManager] Successfully moved folder to alternative disk");
      } else {
        throw new Error(`Copy verification failed: target has ${targetEntries.length} entries, source has ${sourceEntries.length}`);
      }
    } catch (error) {
      logger.error({ error, sourcePath, targetPath }, "[FileManager] Failed to move folder to alternative disk");
      throw error;
    }
  }

  /**
   * Wait for qBittorrent to complete file move operation
   * Polls torrent properties until save_path matches expected path
   */
  private async waitForTorrentMove(
    qbitHash: string,
    expectedPath: string,
    qbittorrent: ITorrentClient,
    maxRetries = 10,
    delayMs = 1000
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      const torrentInfo = await qbittorrent.getTorrentProperties(qbitHash);

      // Check if save_path matches expected path
      // contentPath may be undefined for some torrents, so check before calling startsWith
      const savePathMatches = torrentInfo.savePath === expectedPath;
      const contentPathMatches = torrentInfo.contentPath?.startsWith(expectedPath);

      if (savePathMatches || contentPathMatches) {
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
      logger.error({ error }, `Failed to generate NFO for scene ${sceneId}:`);
    }

    try {
      posterPath = await this.downloadPoster(sceneId, destinationFolder);
    } catch (error) {
      logger.error({ error }, `Failed to download poster for scene ${sceneId}:`);
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
   * Scans all configured download paths, not just the default scenesPath
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

    // Get all download paths to scan
    const pathsToScan: string[] = [];

    // Add default scenesPath
    pathsToScan.push(this.scenesPath);

    // Add configured download paths
    if (this.settingsRepository) {
      try {
        const settings = await this.settingsRepository.getSettings();
        const downloadPaths = settings.downloadPaths?.paths || [];
        for (const dp of downloadPaths) {
          if (dp.path && !pathsToScan.includes(dp.path)) {
            pathsToScan.push(dp.path);
          }
        }
      } catch (error) {
        logger.warn({ error }, "[FileManager] Failed to get download paths for scanning");
      }
    }

    // Scan each path
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg'];
    const knownPaths = new Set(allSceneFiles.map(sf => sf.filePath));

    for (const scanPath of pathsToScan) {
      try {
        // Check if directory exists
        await access(scanPath, constants.F_OK);

        // Scan the directory recursively
        const filesOnDisk = await this.scanDirectory(scanPath);

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
        // If directory doesn't exist or can't be accessed, just log and continue
        logger.warn({ error, scanPath }, `[FileManager] Failed to scan directory ${scanPath}`);
      }
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
      logger.error({ error }, `Failed to scan directory ${dirPath}:`);
    }

    return filePaths;
  }

  /**
   * Delete scene folder and add to exclusions
   * Searches all configured download paths for the folder
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
          logger.error({ error }, `[FileManager] Failed to delete folder ${folderPath}:`);
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
          // Try to find folder by scene title in all configured paths
          const sanitizedTitle = this.sanitizeFilename(scene.title);

          // Get all download paths to search
          const pathsToSearch: string[] = [];
          pathsToSearch.push(this.scenesPath);

          if (this.settingsRepository) {
            try {
              const settings = await this.settingsRepository.getSettings();
              const downloadPaths = settings.downloadPaths?.paths || [];
              for (const dp of downloadPaths) {
                if (dp.path && !pathsToSearch.includes(dp.path)) {
                  pathsToSearch.push(dp.path);
                }
              }
            } catch (error) {
              logger.warn({ error }, "[FileManager] Failed to get download paths for folder deletion");
            }
          }

          // Search each path for matching folders
          for (const searchPath of pathsToSearch) {
            try {
              // Check for folder with exact title match
              const potentialFolder = join(searchPath, sanitizedTitle);
              const exists = await this.checkFolderExists(potentialFolder);
              if (exists) {
                await rm(potentialFolder, { recursive: true, force: true });
                logger.info(`[FileManager] Deleted folder by title: ${potentialFolder}`);
                break; // Found and deleted, no need to check other paths
              }

              // Also check for folders with random suffixes (collision avoidance)
              const entries = await readdir(searchPath, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith(sanitizedTitle)) {
                  const folderPath = join(searchPath, entry.name);
                  try {
                    await rm(folderPath, { recursive: true, force: true });
                    logger.info(`[FileManager] Deleted matching folder: ${folderPath}`);
                    break; // Found and deleted, no need to check other paths
                  } catch (error) {
                    logger.error({ error }, `[FileManager] Failed to delete matching folder ${folderPath}:`);
                  }
                }
              }
            } catch (error) {
              // Path doesn't exist or can't be accessed, continue to next
              logger.debug({ error, searchPath }, `[FileManager] Could not search path for folder deletion`);
            }
          }
        }
      } catch (error) {
        logger.error({ error }, `[FileManager] Failed to delete folder for scene ${sceneId}:`);
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

    // Generate NFO with matching video filename for Jellyfin compatibility
    // Find the video file in the folder to match NFO name
    let videoFilename: string | undefined;
    try {
      const files = await readdir(folderPath);
      // Find video files (mp4, mkv, avi, mov, wmv, webm)
      const videoFile = files.find(f =>
        /\.(mp4|mkv|avi|mov|wmv|webm|m4v|flv)$/i.test(f)
      );
      if (videoFile) {
        videoFilename = videoFile;
      }
    } catch (error) {
      // Folder might not exist yet, that's okay
      this.logger.debug({ error, sceneId }, "Could not read folder for video file");
    }

    const nfoPath = await this.generateNFO(sceneId, folderPath, videoFilename);

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

    // Use optimal download path (with most free space)
    const scenesPath = await this.getOptimalDownloadPath();

    const folderPath = join(
      scenesPath,
      sanitizedTitle
    );

    await mkdir(folderPath, { recursive: true });

    // Generate NFO content using the same logic as buildNFOContent
    // Build actors list with thumbnails
    const performers = scene.performers.map((p) => {
      const name = this.escapeXML(p.name);
      const thumb = p.thumbnail || p.images?.[0]?.url || null;
      const thumbTag = thumb ? `\n    <thumb>${this.escapeXML(thumb)}</thumb>` : "";

      return `  <actor>
    <name>${name}</name>
    <type>Actor</type>${thumbTag}
  </actor>`;
    }).join("\n");

    const studio = scene.studios[0]?.name || "";

    // Extract year from date (format: YYYY-MM-DD)
    let year = "";
    if (scene.date) {
      const dateMatch = scene.date.match(/^(\d{4})/);
      if (dateMatch) {
        year = dateMatch[1];
      }
    }

    // Extract external IDs
    const stashdbId = scene.externalIds?.find((e) => e.source === "stashdb")?.id || null;
    const tpdbId = scene.externalIds?.find((e) => e.source === "tpdb")?.id || null;

    // Build genre tags (multiple allowed)
    const genreTags: string[] = ["Adult"];
    if (scene.contentType) {
      if (scene.contentType === "jav") {
        genreTags.push("JAV");
        genreTags.push("Asian");
      } else if (scene.contentType === "movie") {
        genreTags.push("Movie");
      } else {
        genreTags.push("Scene");
      }
    }
    if (studio) {
      genreTags.push(studio);
    }
    const genres = genreTags.map(g => `  <genre>${this.escapeXML(g)}</genre>`).join("\n");

    // Build style tags based on performer attributes
    const styleTags: string[] = [];
    scene.performers?.forEach(p => {
      if (p.gender) {
        const genderTag = p.gender.charAt(0).toUpperCase() + p.gender.slice(1);
        if (!styleTags.includes(genderTag)) {
          styleTags.push(genderTag);
        }
      }
      if (p.nationality) {
        if (!styleTags.includes(p.nationality)) {
          styleTags.push(p.nationality);
        }
      }
    });
    const styles = styleTags.length > 0
      ? "\n" + styleTags.map(s => `  <style>${this.escapeXML(s)}</style>`).join("\n")
      : "";

    // Build tags (multiple allowed)
    const tagElements = scene.tags.map(t => `  <tag>${this.escapeXML(t)}</tag>`).join("\n");

    // Build trailer in Kodi format if available
    let trailerTag = "";
    if (scene.trailer) {
      let youtubeId = null;
      const youtubeMatch = scene.trailer.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (youtubeMatch) {
        youtubeId = youtubeMatch[1];
        trailerTag = `\n  <trailer>plugin://plugin.video.youtube/?action=play_video&videoid=${youtubeId}</trailer>`;
      } else {
        trailerTag = `\n  <trailer>${this.escapeXML(scene.trailer)}</trailer>`;
      }
    }

    // Build art section if poster or thumbnail available
    let artTag = "";
    if (scene.poster || scene.thumbnail) {
      const posterPath = scene.poster || scene.thumbnail;
      artTag = `\n  <art>\n    <poster>${this.escapeXML(posterPath!)}</poster>\n  </art>`;
    }

    const nfoContent = `<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <title>${this.escapeXML(cleanedTitle)}</title>
  <originaltitle>${this.escapeXML(scene.title)}</originaltitle>
  ${year ? `<year>${year}</year>` : ""}
  ${scene.date ? `<premiered>${scene.date}</premiered>` : ""}
  ${scene.date ? `<releasedate>${scene.date}</releasedate>` : ""}
  ${scene.description ? `<plot>${this.escapeXML(scene.description)}</plot>` : ""}
  ${scene.code ? `<id>${this.escapeXML(scene.code)}</id>` : ""}
  ${studio ? `<studio>${this.escapeXML(studio)}</studio>` : ""}
  ${scene.duration ? `<runtime>${Math.floor(scene.duration / 60)}</runtime>` : ""}
  ${scene.rating && scene.rating > 0 ? `<rating>${scene.rating}</rating>` : ""}${trailerTag}${artTag}
  ${stashdbId ? `<uniqueid type="stashdb" default="true">${stashdbId}</uniqueid>` : ""}
  ${tpdbId ? `<uniqueid type="tpdb" default="false">${tpdbId}</uniqueid>` : ""}
${genres}
${tagElements}${styles}
  <mpaa>XXX</mpaa>
  <lockdata>false</lockdata>
${performers}
</movie>`;

    // Save NFO file (use movie.nfo as filename - Jellyfin standard)
    const nfoPath = join(folderPath, 'movie.nfo');
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
