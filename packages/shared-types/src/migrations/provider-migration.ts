/**
 * Provider Migration
 * Migrates single-instance provider settings to multi-provider format
 */

import type {
  ProvidersConfig,
  MetadataProviderConfig,
  IndexerProviderConfig,
  TorrentClientConfig,
} from "../config/settings/providers.js";
import type { AppSettings } from "../config/settings/app-settings.js";

/**
 * Migrates legacy single-instance settings to multi-provider format
 */
export function migrateToMultiProviders(settings: Partial<AppSettings>): ProvidersConfig {
  const providers: ProvidersConfig = {
    metadata: [],
    indexers: [],
    torrentClients: [],
  };

  // Migrate TPDB
  if (settings.tpdb?.enabled) {
    providers.metadata.push({
      id: generateId(),
      name: "TPDB (Migrated)",
      type: "tpdb",
      enabled: true,
      priority: 1,
      apiUrl: settings.tpdb.apiUrl || "",
      apiKey: settings.tpdb.apiKey || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as MetadataProviderConfig);
  }

  // Migrate StashDB
  if (settings.stashdb?.enabled) {
    providers.metadata.push({
      id: generateId(),
      name: "StashDB (Migrated)",
      type: "stashdb",
      enabled: true,
      priority: providers.metadata.length + 1,
      apiUrl: settings.stashdb.apiUrl || "",
      apiKey: settings.stashdb.apiKey || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as MetadataProviderConfig);
  }

  // Migrate Prowlarr
  if (settings.prowlarr?.enabled) {
    providers.indexers.push({
      id: generateId(),
      name: "Prowlarr (Migrated)",
      type: "prowlarr",
      enabled: true,
      priority: 1,
      baseUrl: settings.prowlarr.apiUrl || "",
      apiKey: settings.prowlarr.apiKey || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as IndexerProviderConfig);
  }

  // Migrate qBittorrent
  if (settings.qbittorrent?.enabled) {
    providers.torrentClients.push({
      id: generateId(),
      name: "qBittorrent (Migrated)",
      type: "qbittorrent",
      enabled: true,
      priority: 1,
      url: settings.qbittorrent.url || "",
      username: settings.qbittorrent.username,
      password: settings.qbittorrent.password,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as TorrentClientConfig);
  }

  return providers;
}

/**
 * Checks if migration is needed
 */
export function needsProviderMigration(settings: Partial<AppSettings>): boolean {
  // If providers already exist and have items, no migration needed
  const providers = settings.providers;
  if (providers && (
    (providers.metadata && providers.metadata.length > 0) ||
    (providers.indexers && providers.indexers.length > 0) ||
    (providers.torrentClients && providers.torrentClients.length > 0)
  )) {
    return false;
  }

  // If legacy settings exist and are enabled, migration is needed
  if (settings.tpdb?.enabled ||
      settings.stashdb?.enabled ||
      settings.prowlarr?.enabled ||
      settings.qbittorrent?.enabled) {
    return true;
  }

  return false;
}

function generateId(): string {
  return `prov-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
