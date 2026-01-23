import fp from "fastify-plugin";
import { SettingsRepository } from "../infrastructure/repositories/settings.repository.js";

interface ProwlarrConfig {
  baseUrl: string;
  apiKey: string;
}

declare module "fastify" {
  interface FastifyInstance {
    prowlarrConfig?: ProwlarrConfig;
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

  const prowlarrUrl = settings.prowlarr?.apiUrl;
  if (!settings.prowlarr?.enabled || !prowlarrUrl) {
    app.log.warn("Prowlarr not configured. Indexer management will be disabled.");
    app.decorate("prowlarrConfig", undefined);
    return;
  }

  const prowlarrConfig: ProwlarrConfig = {
    baseUrl: prowlarrUrl,
    apiKey: settings.prowlarr.apiKey || "",
  };

  app.decorate("prowlarrConfig", prowlarrConfig);
  app.log.info({ apiUrl: prowlarrUrl }, "Prowlarr config registered");
});
