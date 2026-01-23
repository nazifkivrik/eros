import fp from "fastify-plugin";
import { SettingsRepository } from "../infrastructure/repositories/settings.repository.js";

interface QBittorrentConfig {
  url: string;
  username: string;
  password: string;
}

declare module "fastify" {
  interface FastifyInstance {
    qbittorrentConfig?: QBittorrentConfig;
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

  if (!settings.qbittorrent.enabled || !settings.qbittorrent.url) {
    app.log.warn("qBittorrent not configured. Download functionality will be disabled.");
    app.decorate("qbittorrentConfig", undefined);
    return;
  }

  const qbittorrentConfig: QBittorrentConfig = {
    url: settings.qbittorrent.url,
    username: settings.qbittorrent.username,
    password: settings.qbittorrent.password,
  };

  app.decorate("qbittorrentConfig", qbittorrentConfig);
  app.log.info({ url: settings.qbittorrent.url }, "qBittorrent config registered");
});
