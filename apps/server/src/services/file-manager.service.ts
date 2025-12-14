import { mkdir, writeFile, readdir, stat, rename, rm, access } from "fs/promises";
import { join, basename, extname, dirname } from "path";
import type { Database } from "@repo/database";
import { eq } from "drizzle-orm";
import { scenes, performers, studios, sceneFiles, sceneExclusions } from "@repo/database";
import { constants } from "fs";

export type SceneMetadata = {
  id: string;
  stashdbId: string | null;
  title: string;
  date: string | null;
  details: string | null;
  duration: number | null;
  director: string | null;
  code: string | null;
  urls: string[];
  images: Array<{ url: string; width?: number; height?: number }>;
  performers: Array<{
    id: string;
    name: string;
  }>;
  studios: Array<{
    id: string;
    name: string;
  }>;
};

export class FileManagerService {
  private downloadPath: string;
  private scenesPath: string;
  // Used for future implementation of incomplete downloads handling
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private incompletePath: string;

  constructor(
    private db: Database,
    downloadPath?: string,
    scenesPath?: string,
    incompletePath?: string
  ) {
    this.downloadPath = downloadPath || process.env.DOWNLOAD_PATH || "/downloads";
    this.scenesPath = scenesPath || process.env.SCENES_PATH || "/scenes";
    this.incompletePath = incompletePath || process.env.INCOMPLETE_PATH || "/incomplete";
  }

  /**
   * Create folder structure for a scene
   * Format: /downloads/{studio}/{scene_title}_{scene_id}/
   */
  async createSceneFolder(sceneId: string): Promise<string> {
    // Get scene with performers and studios
    const scene = await this.getSceneWithMetadata(sceneId);

    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`);
    }

    // Sanitize folder names
    const studioName = scene.studios[0]?.name || "Unknown";
    const sanitizedStudio = this.sanitizeFilename(studioName);
    const sanitizedTitle = this.sanitizeFilename(scene.title);

    // Create folder path: /downloads/{studio}/{title}_{id}/
    const folderPath = join(
      this.downloadPath,
      sanitizedStudio,
      `${sanitizedTitle}_${scene.id}`
    );

    // Create directory recursively
    await mkdir(folderPath, { recursive: true });

    return folderPath;
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
      console.error(`Failed to download poster for scene ${sceneId}:`, error);
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
  private async getSceneWithMetadata(sceneId: string): Promise<SceneMetadata | null> {
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

    // Get studios for this scene
    const studioRecords = await this.db.query.studiosScenes.findMany({
      where: (studiosScenes, { eq }) => eq(studiosScenes.sceneId, sceneId),
    });

    const studioIds = studioRecords.map((ss) => ss.studioId);
    const studiosData = await Promise.all(
      studioIds.map((id) =>
        this.db.query.studios.findFirst({
          where: eq(studios.id, id),
        })
      )
    );

    return {
      id: scene.id,
      stashdbId: scene.stashdbId,
      title: scene.title,
      date: scene.date,
      details: scene.details,
      duration: scene.duration,
      director: scene.director,
      code: scene.code,
      urls: scene.urls as string[],
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
  private buildNFOContent(scene: SceneMetadata): string {
    const performers = scene.performers.map((p) => `    <actor>\n      <name>${this.escapeXML(p.name)}</name>\n    </actor>`).join("\n");

    const studio = scene.studios[0]?.name || "";

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>${this.escapeXML(scene.title)}</title>
  <originaltitle>${this.escapeXML(scene.title)}</originaltitle>
  ${scene.date ? `<premiered>${scene.date}</premiered>` : ""}
  ${scene.date ? `<releasedate>${scene.date}</releasedate>` : ""}
  ${studio ? `<studio>${this.escapeXML(studio)}</studio>` : ""}
  ${scene.director ? `<director>${this.escapeXML(scene.director)}</director>` : ""}
  ${scene.details ? `<plot>${this.escapeXML(scene.details)}</plot>` : ""}
  ${scene.code ? `<id>${this.escapeXML(scene.code)}</id>` : ""}
  ${scene.stashdbId ? `<uniqueid type="stashdb">${scene.stashdbId}</uniqueid>` : ""}
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
      console.error(`Failed to generate NFO for scene ${sceneId}:`, error);
    }

    try {
      posterPath = await this.downloadPoster(sceneId, destinationFolder);
    } catch (error) {
      console.error(`Failed to download poster for scene ${sceneId}:`, error);
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
      console.error(`Failed to scan scenes directory ${this.scenesPath}:`, error);
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
      console.error(`Failed to scan directory ${dirPath}:`, error);
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

    // Delete folder if exists
    for (const file of files) {
      const folderPath = dirname(file.filePath);
      try {
        await rm(folderPath, { recursive: true, force: true });
      } catch (error) {
        console.error(`Failed to delete folder ${folderPath}:`, error);
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
   * Create complete scene folder with metadata files
   */
  async setupSceneFiles(sceneId: string): Promise<{
    folderPath: string;
    posterPath: string | null;
    nfoPath: string;
  }> {
    // Create folder
    const folderPath = await this.createSceneFolder(sceneId);

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
}

export function createFileManagerService(
  db: Database,
  downloadPath?: string,
  scenesPath?: string,
  incompletePath?: string
): FileManagerService {
  return new FileManagerService(db, downloadPath, scenesPath, incompletePath);
}
