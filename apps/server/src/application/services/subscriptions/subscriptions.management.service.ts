import type { Logger } from "pino";
import type { FileManagerService } from "../../../file-management/file-manager.service.js";
import type { SubscriptionsRepository } from "../../../infrastructure/repositories/subscriptions.repository.js";
import type { SettingsRepository } from "../../../infrastructure/repositories/settings.repository.js";
import { eq } from "drizzle-orm";
import { subscriptions, scenes } from "@repo/database";
import type { Database } from "@repo/database";

/**
 * Create Folder Result
 */
export interface CreateFolderResult {
  success: boolean;
  folderPath: string | null;
  error: string | null;
}

/**
 * Create Metadata Result
 */
export interface CreateMetadataResult {
  success: boolean;
  nfoPath: string | null;
  posterPath: string | null;
  error: string | null;
}

/**
 * Delete Files Result
 */
export interface DeleteFilesResult {
  success: boolean;
  deletedCount: number;
  error: string | null;
}

/**
 * Organization Options
 */
export interface OrganizationOptions {
  createNfo: boolean;
  downloadPoster: boolean;
  folderFormat: string; // e.g., "{title} ({date})", "{studio}/{title}", etc.
}

/**
 * Subscriptions Management Service
 * Handles file and folder operations for subscriptions
 * Uses FileManagerService for actual filesystem operations
 */
export class SubscriptionsManagementService {
  private fileManager: FileManagerService;
  private subscriptionsRepository: SubscriptionsRepository;
  private settingsRepository: SettingsRepository;
  private db: Database;
  private logger: Logger;

  constructor({
    fileManager,
    subscriptionsRepository,
    settingsRepository,
    db,
    logger,
  }: {
    fileManager: FileManagerService;
    subscriptionsRepository: SubscriptionsRepository;
    settingsRepository: SettingsRepository;
    db: Database;
    logger: Logger;
  }) {
    this.fileManager = fileManager;
    this.subscriptionsRepository = subscriptionsRepository;
    this.settingsRepository = settingsRepository;
    this.db = db;
    this.logger = logger;
  }

  /**
   * Create organized folder structure for a subscription's scene
   * Uses FileManagerService's createSceneFolder method
   */
  async createSubscriptionFolder(sceneId: string): Promise<CreateFolderResult> {
    this.logger.info({ sceneId }, "Creating subscription folder for scene");

    try {
      const folderPath = await this.fileManager.createSceneFolder(sceneId);

      this.logger.info({ sceneId, folderPath }, "Subscription folder created");

      return {
        success: true,
        folderPath,
        error: null,
      };
    } catch (error) {
      this.logger.error({ error, sceneId }, "Failed to create subscription folder");

      return {
        success: false,
        folderPath: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create metadata files (NFO and poster) for a scene
   */
  async createMetadataFiles(sceneId: string, folderPath: string): Promise<CreateMetadataResult> {
    this.logger.info({ sceneId, folderPath }, "Creating metadata files");

    const result: CreateMetadataResult = {
      success: true,
      nfoPath: null,
      posterPath: null,
      error: null,
    };

    try {
      // Generate NFO file
      const nfoPath = await this.fileManager.generateNFO(sceneId, folderPath);
      result.nfoPath = nfoPath;
      this.logger.info({ sceneId, nfoPath }, "NFO file created");
    } catch (error) {
      this.logger.error({ error, sceneId }, "Failed to create NFO file");
      result.error = error instanceof Error ? error.message : "Failed to create NFO";
      result.success = false;
    }

    try {
      // Download poster
      const posterPath = await this.fileManager.downloadPoster(sceneId, folderPath);
      if (posterPath) {
        result.posterPath = posterPath;
        this.logger.info({ sceneId, posterPath }, "Poster downloaded");
      }
    } catch (error) {
      this.logger.warn({ error, sceneId }, "Failed to download poster (non-critical)");
      // Don't fail the entire operation if poster download fails
    }

    return result;
  }

  /**
   * Delete all files and folder for a scene
   */
  async deleteSceneFiles(sceneId: string): Promise<DeleteFilesResult> {
    this.logger.info({ sceneId }, "Deleting scene files");

    try {
      // Get scene to find folder
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, sceneId),
      });

      if (!scene) {
        return {
          success: false,
          deletedCount: 0,
          error: "Scene not found",
        };
      }

      // Get settings to find scenes path
      const settingRecord = await this.settingsRepository.findByKey("app-settings");
      if (!settingRecord) {
        return {
          success: false,
          deletedCount: 0,
          error: "Settings not found",
        };
      }

      const settings = settingRecord.value as any;
      const { join } = await import("path");

      // Construct folder path
      const sanitizedTitle = scene.title.replace(/[/\\?%*:|"<>]/g, "_");
      const folderPath = join(settings.general?.scenesPath || "./scenes", sanitizedTitle);

      // Delete folder
      const { rm } = await import("fs/promises");
      const { access } = await import("fs/promises");

      // Check if folder exists
      try {
        await access(folderPath);
        await rm(folderPath, { recursive: true, force: true });

        this.logger.info({ sceneId, folderPath }, "Scene files deleted");

        return {
          success: true,
          deletedCount: 1,
          error: null,
        };
      } catch {
        // Folder doesn't exist, that's fine
        return {
          success: true,
          deletedCount: 0,
          error: null,
        };
      }
    } catch (error) {
      this.logger.error({ error, sceneId }, "Failed to delete scene files");

      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * List files in subscription's scene folder
   */
  async getSubscriptionFiles(subscriptionId: string): Promise<{
    files: Array<{
      fileName: string;
      filePath: string;
      fileSize: number;
    }>;
    sceneFolder: string | null;
    error: string | null;
  }> {
    this.logger.info({ subscriptionId }, "Getting subscription files");

    try {
      // Get subscription
      const subscription = await this.subscriptionsRepository.findById(subscriptionId);
      if (!subscription) {
        return {
          files: [],
          sceneFolder: null,
          error: "Subscription not found",
        };
      }

      // Only scene subscriptions have files
      if (subscription.entityType !== "scene") {
        return {
          files: [],
          sceneFolder: null,
          error: "Only scene subscriptions have files",
        };
      }

      // Get scene
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, subscription.entityId),
      });

      if (!scene) {
        return {
          files: [],
          sceneFolder: null,
          error: "Scene not found",
        };
      }

      // Get settings to find scenes path
      const settingRecord = await this.settingsRepository.findByKey("app-settings");
      if (!settingRecord) {
        return {
          files: [],
          sceneFolder: null,
          error: "Settings not found",
        };
      }

      const settings = settingRecord.value as any;
      const { join } = await import("path");
      const { readdir, stat } = await import("fs/promises");

      // Construct folder path
      const sanitizedTitle = scene.title.replace(/[/\\?%*:|"<>]/g, "_");
      const folderPath = join(settings.general?.scenesPath || "./scenes", sanitizedTitle);

      // Check if folder exists
      try {
        await stat(folderPath);
      } catch {
        return {
          files: [],
          sceneFolder: folderPath,
          error: null,
        };
      }

      // List files
      const fileNames = await readdir(folderPath);
      const files = await Promise.all(
        fileNames.map(async (fileName) => {
          const filePath = join(folderPath, fileName);
          const stats = await stat(filePath);
          return {
            fileName,
            filePath,
            fileSize: stats.size,
          };
        })
      );

      this.logger.info({ subscriptionId, count: files.length }, "Subscription files retrieved");

      return {
        files,
        sceneFolder: folderPath,
        error: null,
      };
    } catch (error) {
      this.logger.error({ error, subscriptionId }, "Failed to get subscription files");

      return {
        files: [],
        sceneFolder: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Organize scene files according to settings
   * Reorganizes files based on folder format, naming convention, etc.
   */
  async organizeSceneFiles(sceneId: string, options: OrganizationOptions): Promise<{
    success: boolean;
    oldPath: string | null;
    newPath: string | null;
    error: string | null;
  }> {
    this.logger.info({ sceneId, options }, "Organizing scene files");

    try {
      // Get scene
      const scene = await this.db.query.scenes.findFirst({
        where: eq(scenes.id, sceneId),
      });

      if (!scene) {
        return {
          success: false,
          oldPath: null,
          newPath: null,
          error: "Scene not found",
        };
      }

      // Get settings
      const settingRecord = await this.settingsRepository.findByKey("app-settings");
      if (!settingRecord) {
        return {
          success: false,
          oldPath: null,
          newPath: null,
          error: "Settings not found",
        };
      }

      const settings = settingRecord.value as any;
      const { join } = await import("path");
      const { readdir, rename, stat } = await import("fs/promises");

      const scenesPath = settings.general?.scenesPath || "./scenes";

      // Find current folder (search by scene title)
      const sanitizedTitle = scene.title.replace(/[/\\?%*:|"<>]/g, "_");
      const oldPath = join(scenesPath, sanitizedTitle);

      // Check if folder exists
      try {
        await stat(oldPath);
      } catch {
        return {
          success: false,
          oldPath: null,
          newPath: null,
          error: "Scene folder not found",
        };
      }

      // Generate new folder name based on format
      const newFolderName = this.formatFolderName(scene, options.folderFormat);
      const newPath = join(scenesPath, newFolderName);

      // Rename folder
      await rename(oldPath, newPath);

      this.logger.info({ sceneId, oldPath, newPath }, "Scene folder reorganized");

      return {
        success: true,
        oldPath,
        newPath,
        error: null,
      };
    } catch (error) {
      this.logger.error({ error, sceneId }, "Failed to organize scene files");

      return {
        success: false,
        oldPath: null,
        newPath: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Format folder name based on pattern
   * Supports: {title}, {date}, {code}, {studio}
   */
  private formatFolderName(scene: any, format: string): string {
    const studioName = scene.siteId ? scene.siteId : "Unknown";

    return format
      .replace("{title}", scene.title.replace(/[/\\?%*:|"<>]/g, "_"))
      .replace("{date}", scene.date || "")
      .replace("{code}", scene.code || "")
      .replace("{studio}", studioName)
      .replace(/\/+/g, "/") // Clean up double slashes
      .replace(/\/$/, ""); // Remove trailing slash
  }
}
