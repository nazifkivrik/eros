/**
 * External Services Configuration Manager
 * Manages configuration for external service integrations with dynamic reload capability
 */

import type { Database } from "@repo/database";
import { SettingsRepository } from "../infrastructure/repositories/settings.repository.js";
import type { ExternalServiceConfig } from "../container/index.js";
import type { AppSettings } from "@repo/shared-types";
import { EventEmitter } from "events";

/**
 * External Services Manager
 * Loads external service configs from database and provides reload capability
 */
export class ExternalServicesManager extends EventEmitter {
  private db: Database;
  private config: ExternalServiceConfig = {};
  private initialized = false;

  constructor(db: Database) {
    super();
    this.db = db;
  }

  /**
   * Initialize the manager by loading configs from database
   */
  async initialize(): Promise<void> {
    await this.reload();
    this.initialized = true;
  }

  /**
   * Reload all external service configs from database
   * Emits 'config:updated' event with new config
   */
  async reload(): Promise<void> {
    const settingsRepository = new SettingsRepository({ db: this.db });
    const settingRecord = await settingsRepository.findByKey("app-settings");

    // Use default settings if none found
    const { DEFAULT_SETTINGS } = await import("@repo/shared-types");
    const settings: AppSettings = settingRecord
      ? (settingRecord.value as AppSettings)
      : DEFAULT_SETTINGS;

    // Build new config object
    const newConfig: ExternalServiceConfig = {};

    // TPDB config
    if (settings.tpdb?.enabled && settings.tpdb?.apiKey) {
      newConfig.tpdb = {
        apiUrl: settings.tpdb?.apiUrl || "https://api.theporndb.net",
        apiKey: settings.tpdb?.apiKey || "",
      };
    }

    // StashDB config
    if (settings.stashdb?.enabled && settings.stashdb?.apiUrl) {
      newConfig.stashdb = {
        apiUrl: settings.stashdb.apiUrl,
        apiKey: settings.stashdb.apiKey,
      };
    }

    // qBittorrent config
    if (settings.qbittorrent?.enabled && settings.qbittorrent?.url) {
      newConfig.qbittorrent = {
        url: settings.qbittorrent.url,
        username: settings.qbittorrent.username,
        password: settings.qbittorrent.password,
      };
    }

    // Prowlarr config
    const prowlarrUrl = settings.prowlarr?.apiUrl;
    if (settings.prowlarr?.enabled && prowlarrUrl) {
      newConfig.prowlarr = {
        baseUrl: prowlarrUrl,
        apiKey: settings.prowlarr.apiKey || "",
      };
    }

    // Update config and emit event
    const oldConfig = this.config;
    this.config = newConfig;

    this.emit("config:updated", newConfig, oldConfig);
  }

  /**
   * Get current external service config
   */
  getConfig(): ExternalServiceConfig {
    return this.config;
  }

  /**
   * Check if manager has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Event types for ExternalServicesManager
 */
export interface ExternalServicesEvents {
  configUpdated: [ExternalServiceConfig, ExternalServiceConfig?];
}
