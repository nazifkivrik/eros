import fp from "fastify-plugin";
import { QBittorrentService } from "../services/qbittorrent.service.js";

declare module "fastify" {
  interface FastifyInstance {
    qbittorrent: QBittorrentService | null;
  }
}

export default fp(async (app) => {
  const url = process.env.QBITTORRENT_URL;
  const username = process.env.QBITTORRENT_USERNAME || "admin";
  const password = process.env.QBITTORRENT_PASSWORD || "adminadmin";

  if (!url) {
    app.log.warn("qBittorrent URL not configured. Download functionality will be disabled.");
    app.decorate("qbittorrent", null);
    return;
  }

  const qbittorrent = new QBittorrentService({
    url,
    username,
    password,
  });

  // Test connection
  try {
    const connected = await qbittorrent.testConnection();
    if (!connected) {
      throw new Error("Connection test failed");
    }
    app.log.info("qBittorrent plugin registered and connected", { url });
  } catch (error) {
    app.log.error({ error, url }, "Failed to connect to qBittorrent");
    app.decorate("qbittorrent", null);
    return;
  }

  app.decorate("qbittorrent", qbittorrent);
});
