export type SetupStatus = {
  setupCompleted: boolean;
  hasAdmin: boolean;
};

export type SetupData = {
  // Step 1: Admin account (required)
  username: string;
  password: string;

  // Step 2: Optional settings
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
};

export type User = {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
};
