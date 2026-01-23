import fp from "fastify-plugin";
import { SettingsRepository } from "../infrastructure/repositories/settings.repository.js";

interface TPDBConfig {
  apiUrl: string;
  apiKey: string;
}

declare module "fastify" {
  interface FastifyInstance {
    tpdbConfig?: TPDBConfig;
  }
}

export default fp(async (app) => {
  await app.after();

  // Get settings from database using repository
  const settingsRepository = new SettingsRepository({ db: app.db });
  const settingRecord = await settingsRepository.findByKey("app-settings");

  // Use default settings if none found
  const { DEFAULT_SETTINGS } = await import("@repo/shared-types");
  const settings = settingRecord
    ? (settingRecord.value as any)
    : DEFAULT_SETTINGS;

  if (!settings.tpdb?.enabled || !settings.tpdb?.apiKey) {
    app.log.warn("TPDB not configured. Metadata features will be limited.");
    app.decorate("tpdbConfig", undefined);
    return;
  }

  const tpdbConfig: TPDBConfig = {
    apiUrl: settings.tpdb?.apiUrl || "https://api.theporndb.net",
    apiKey: settings.tpdb?.apiKey || "",
  };

  app.decorate("tpdbConfig", tpdbConfig);

  app.log.info(
    {
      apiUrl: settings.tpdb?.apiUrl,
      hasApiKey: !!settings.tpdb?.apiKey,
      enabled: settings.tpdb?.enabled,
    },
    "TPDB config registered"
  );
});
