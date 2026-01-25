import { nanoid } from "nanoid";
import argon2 from "argon2";
import type { Logger } from "pino";
import type { AppSettings } from "@repo/shared-types";
import { DEFAULT_SETTINGS } from "@repo/shared-types";
import { SetupRepository } from "@/infrastructure/repositories/setup.repository.js";

/**
 * DTOs for Setup Service
 */
export interface SetupStatusDTO {
  setupCompleted: boolean;
  hasAdmin: boolean;
}

export interface SetupDataDTO {
  username: string;
  password: string;
  settings?: {
    qbittorrent?: {
      url: string;
      username: string;
      password: string;
      enabled: boolean;
    };
    prowlarr?: {
      apiUrl: string;
      apiKey: string;
      enabled: boolean;
    };
    stashdb?: {
      apiUrl: string;
      apiKey: string;
      enabled: boolean;
    };
  };
}

/**
 * Setup Service (Clean Architecture)
 * Handles initial application setup
 * Business logic: password hashing, settings merging, validation
 */
export class SetupService {
  private setupRepository: SetupRepository;
  private logger: Logger;

  constructor({ setupRepository, logger }: { setupRepository: SetupRepository; logger: Logger }) {
    this.setupRepository = setupRepository;
    this.logger = logger;
  }

  /**
   * Get setup status
   */
  async getSetupStatus(): Promise<SetupStatusDTO> {
    this.logger.info("Checking setup status");
    const hasUsers = await this.setupRepository.hasUsers();

    return {
      setupCompleted: hasUsers,
      hasAdmin: hasUsers,
    };
  }

  /**
   * Complete initial setup
   * Business logic: password hashing, user creation, settings initialization
   */
  async completeSetup(data: SetupDataDTO): Promise<void> {
    this.logger.info({ username: data.username }, "Completing initial setup");

    // Business rule: Setup can only be completed once
    const status = await this.getSetupStatus();
    if (status.setupCompleted) {
      throw new Error("Setup has already been completed");
    }

    // Business logic: Hash password using Argon2id
    const passwordHash = await argon2.hash(data.password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // Create admin user
    await this.setupRepository.createUser({
      id: nanoid(),
      username: data.username,
      passwordHash,
    });

    this.logger.info({ username: data.username }, "Admin user created");

    // Update settings if provided
    if (data.settings) {
      await this.initializeSettings(data.settings);
      this.logger.info("Settings initialized");
    }
  }

  /**
   * Initialize application settings during setup
   * Business logic: Merge provided settings with defaults
   */
  private async initializeSettings(providedSettings: SetupDataDTO["settings"]) {
    const existingSettings = await this.setupRepository.getAppSettings();

    const baseSettings: AppSettings =
      existingSettings
        ? { ...DEFAULT_SETTINGS, ...(existingSettings.value as AppSettings) }
        : DEFAULT_SETTINGS;

    // Business logic: Merge provided settings with defaults
    const updatedSettings: AppSettings = {
      ...baseSettings,
      qbittorrent: providedSettings?.qbittorrent
        ? {
          url: providedSettings.qbittorrent.url,
          username: providedSettings.qbittorrent.username,
          password: providedSettings.qbittorrent.password,
          enabled: providedSettings.qbittorrent.enabled,
        }
        : baseSettings.qbittorrent,
      prowlarr: providedSettings?.prowlarr
        ? {
          apiUrl: providedSettings.prowlarr.apiUrl,
          apiKey: providedSettings.prowlarr.apiKey,
          enabled: providedSettings.prowlarr.enabled,
        }
        : baseSettings.prowlarr,
      stashdb: providedSettings?.stashdb
        ? {
          apiUrl: providedSettings.stashdb.apiUrl,
          apiKey: providedSettings.stashdb.apiKey,
          enabled: providedSettings.stashdb.enabled,
        }
        : baseSettings.stashdb,
    };

    // Create or update settings
    if (existingSettings) {
      await this.setupRepository.updateAppSettings(updatedSettings);
    } else {
      await this.setupRepository.createAppSettings(updatedSettings);
    }
  }
}
