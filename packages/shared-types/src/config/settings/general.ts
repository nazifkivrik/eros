/**
 * General application settings
 */
export type GeneralSettings = {
  scenesPath: string;
  incompletePath: string;
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  scenesPath: "/app/media/scenes",
  incompletePath: "/app/media/incomplete",
};
