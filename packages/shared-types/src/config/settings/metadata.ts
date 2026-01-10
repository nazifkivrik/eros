/**
 * Metadata service settings
 */
export type StashDBSettings = {
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
};

export type TPDBSettings = {
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
};

export const DEFAULT_STASHDB_SETTINGS: StashDBSettings = {
  apiUrl: "https://stashdb.org/graphql",
  apiKey: "",
  enabled: false,
};

export const DEFAULT_TPDB_SETTINGS: TPDBSettings = {
  apiUrl: "https://api.theporndb.net",
  apiKey: "",
  enabled: false,
};
