/**
 * Setup status response
 * Used by setup routes to determine if app is initialized
 */
export type SetupStatus = {
  setupCompleted: boolean;
  hasAdmin: boolean;
};

/**
 * Setup wizard data
 * Used during initial app configuration
 */
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

/**
 * User entity (minimal for setup)
 * Full User type may live in auth module
 */
export type User = {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
};
