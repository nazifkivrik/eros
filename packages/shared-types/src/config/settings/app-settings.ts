import type { GeneralSettings } from "./general.js";
import type { FileManagementSettings } from "./file-management.js";
import type {
  StashDBSettings,
  TPDBSettings,
  MetadataSettings,
} from "./metadata.js";
import type { ProwlarrSettings, QBittorrentSettings } from "./services.js";
import type { AISettings } from "./ai.js";
import type { JobSchedulerSettings } from "./jobs.js";

import { DEFAULT_GENERAL_SETTINGS } from "./general.js";
import { DEFAULT_FILE_MANAGEMENT_SETTINGS } from "./file-management.js";
import {
  DEFAULT_STASHDB_SETTINGS,
  DEFAULT_TPDB_SETTINGS,
  DEFAULT_METADATA_SETTINGS,
} from "./metadata.js";
import {
  DEFAULT_PROWLARR_SETTINGS,
  DEFAULT_QBITTORRENT_SETTINGS,
} from "./services.js";
import { DEFAULT_AI_SETTINGS } from "./ai.js";
import { DEFAULT_JOB_SCHEDULER_SETTINGS } from "./jobs.js";

/**
 * Complete application settings
 * Composition of all setting categories
 */
export type AppSettings = {
  general: GeneralSettings;
  fileManagement: FileManagementSettings;
  stashdb: StashDBSettings;
  tpdb: TPDBSettings;
  metadata: MetadataSettings;
  prowlarr: ProwlarrSettings;
  qbittorrent: QBittorrentSettings;
  ai: AISettings;
  jobs: JobSchedulerSettings;
};

/**
 * Default settings aggregate
 * Single source of truth composed from individual defaults
 */
export const DEFAULT_SETTINGS = {
  general: DEFAULT_GENERAL_SETTINGS,
  fileManagement: DEFAULT_FILE_MANAGEMENT_SETTINGS,
  stashdb: DEFAULT_STASHDB_SETTINGS,
  tpdb: DEFAULT_TPDB_SETTINGS,
  metadata: DEFAULT_METADATA_SETTINGS,
  prowlarr: DEFAULT_PROWLARR_SETTINGS,
  qbittorrent: DEFAULT_QBITTORRENT_SETTINGS,
  ai: DEFAULT_AI_SETTINGS,
  jobs: DEFAULT_JOB_SCHEDULER_SETTINGS,
} as const satisfies AppSettings;
