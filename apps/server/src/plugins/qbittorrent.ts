import fp from "fastify-plugin";
import { QBittorrentService } from "../services/qbittorrent.service.js";

declare module "fastify" {
  interface FastifyInstance {
    qbittorrent: QBittorrentService | null;
  }
}

export default fp(async (app) => {
  // Wait for database plugin to be ready
  await app.after();

  // Get settings from database
  const { createSettingsService } = await import("../services/settings.service.js");
  const settingsService = createSettingsService(app.db);
  const settings = await settingsService.getSettings();

  if (!settings.qbittorrent.enabled || !settings.qbittorrent.url) {
    app.log.warn("qBittorrent not configured. Download functionality will be disabled.");
    app.decorate("qbittorrent", null);
    return;
  }

  const qbittorrent = new QBittorrentService({
    url: settings.qbittorrent.url,
    username: settings.qbittorrent.username,
    password: settings.qbittorrent.password,
  });

  // Test connection
  try {
    const connected = await qbittorrent.testConnection();
    if (!connected) {
      throw new Error("Connection test failed");
    }
    app.log.info({ url: settings.qbittorrent.url }, "qBittorrent plugin registered and connected");
  } catch (error) {
    app.log.error({ error, url: settings.qbittorrent.url }, "Failed to connect to qBittorrent");
    app.decorate("qbittorrent", null);
    return;
  }

  app.decorate("qbittorrent", qbittorrent);
});
