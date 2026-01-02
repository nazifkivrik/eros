/**
 * General application settings
 */
export type GeneralSettings = {
  appName: string;
  downloadPath: string;
  scenesPath: string;
  incompletePath: string;
  enableNotifications: boolean;
  minIndexersForMetadataLess: number;
  groupingThreshold: number; // Threshold for merging truncated scene titles (0.0-1.0)
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  appName: "Eros",
  downloadPath: "/downloads",
  scenesPath: "/app/media/scenes",
  incompletePath: "/app/media/incomplete",
  enableNotifications: true,
  minIndexersForMetadataLess: 2,
  groupingThreshold: 0.7, // 70% match required for truncated title merging
};
