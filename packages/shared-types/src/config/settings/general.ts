/**
 * General application settings
 */
export type GeneralSettings = {
  appName: string;
  downloadPath: string;
  scenesPath: string;
  incompletePath: string;
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  appName: "Eros",
  downloadPath: "/downloads",
  scenesPath: "/app/media/scenes",
  incompletePath: "/app/media/incomplete",
};
