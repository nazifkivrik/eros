import fp from "fastify-plugin";
import { StashDBService } from "../services/stashdb.service.js";

declare module "fastify" {
  interface FastifyInstance {
    stashdb: StashDBService;
  }
}

export default fp(async (app) => {
  // Wait for database plugin to be ready
  await app.after();

  // Get settings from database
  const { createSettingsService } = await import("../services/settings.service.js");
  const settingsService = createSettingsService(app.db);
  const settings = await settingsService.getSettings();

  // Debug log to see what we got
  app.log.debug({
    enabled: settings.stashdb.enabled,
    hasApiKey: !!settings.stashdb.apiKey,
    apiKeyLength: settings.stashdb.apiKey?.length,
    apiUrl: settings.stashdb.apiUrl
  }, "StashDB settings loaded from database");

  if (!settings.stashdb.enabled || !settings.stashdb.apiKey) {
    app.log.warn("StashDB not configured. Service will be limited.");
  }

  const stashdb = new StashDBService({
    apiUrl: settings.stashdb.apiUrl,
    apiKey: settings.stashdb.apiKey,
  });

  app.decorate("stashdb", stashdb);

  app.log.info(
    {
      apiUrl: settings.stashdb.apiUrl,
      hasApiKey: !!settings.stashdb.apiKey,
    },
    "StashDB plugin registered"
  );
});

