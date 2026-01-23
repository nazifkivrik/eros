import fp from "fastify-plugin";
import { SettingsRepository } from "../infrastructure/repositories/settings.repository.js";

interface StashDBConfig {
  apiUrl: string;
  apiKey?: string;
}

declare module "fastify" {
  interface FastifyInstance {
    stashdbConfig?: StashDBConfig;
  }
}

export default fp(async (app) => {
  // Wait for database plugin to be ready
  await app.after();

  // Get settings from database using repository
  const settingsRepository = new SettingsRepository({ db: app.db });
  const settingRecord = await settingsRepository.findByKey("app-settings");

  // Use default settings if none found
  const { DEFAULT_SETTINGS } = await import("@repo/shared-types");
  const settings = settingRecord
    ? (settingRecord.value as any)
    : DEFAULT_SETTINGS;

  if (!settings.stashdb.enabled || !settings.stashdb.apiUrl) {
    app.log.warn("StashDB not configured. Service will be limited.");
    app.decorate("stashdbConfig", undefined);
    return;
  }

  const stashdbConfig: StashDBConfig = {
    apiUrl: settings.stashdb.apiUrl,
    apiKey: settings.stashdb.apiKey,
  };

  app.decorate("stashdbConfig", stashdbConfig);

  app.log.info(
    {
      apiUrl: settings.stashdb.apiUrl,
      hasApiKey: !!settings.stashdb.apiKey,
    },
    "StashDB config registered"
  );
});

