import fp from "fastify-plugin";
import { TPDBService } from "../services/tpdb/tpdb.service.js";

declare module "fastify" {
  interface FastifyInstance {
    tpdb: TPDBService;
  }
}

export default fp(async (app) => {
  await app.after();

  const { createSettingsService } = await import("../services/settings.service.js");
  const settingsService = createSettingsService(app.db);
  const settings = await settingsService.getSettings();

  if (!settings.tpdb?.enabled || !settings.tpdb?.apiKey) {
    app.log.warn("TPDB not configured. Metadata features will be limited.");
  }

  const tpdb = new TPDBService({
    apiUrl: settings.tpdb?.apiUrl || "https://api.theporndb.net",
    apiKey: settings.tpdb?.apiKey || "",
  });

  app.decorate("tpdb", tpdb);

  app.log.info(
    {
      apiUrl: settings.tpdb?.apiUrl,
      hasApiKey: !!settings.tpdb?.apiKey,
      enabled: settings.tpdb?.enabled,
    },
    "TPDB plugin registered"
  );
});
