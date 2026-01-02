/**
 * External service integration settings
 */
export type ProwlarrSettings = {
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
};

export type QBittorrentSettings = {
  url: string;
  username: string;
  password: string;
  enabled: boolean;
};

export const DEFAULT_PROWLARR_SETTINGS: ProwlarrSettings = {
  apiUrl: "",
  apiKey: "",
  enabled: false,
};

export const DEFAULT_QBITTORRENT_SETTINGS: QBittorrentSettings = {
  url: "",
  username: "",
  password: "",
  enabled: false,
};
