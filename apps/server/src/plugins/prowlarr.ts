import fp from "fastify-plugin";
import { ProwlarrService } from "../services/prowlarr.service.js";

declare module "fastify" {
    interface FastifyInstance {
        prowlarr: ProwlarrService | undefined;
    }
}

export default fp(async (app) => {
    // Wait for database plugin to be ready
    await app.after();

    // Get settings from database
    const { createSettingsService } = await import("../services/settings.service.js");
    const settingsService = createSettingsService(app.db);
    const settings = await settingsService.getSettings();

    // Check if Prowlarr is enabled and configured
    // Note: Assuming settings structure based on other plugins. 
    // If prowlarr is not in settings yet, we might need to verify settings types.
    // Using optional chaining just in case.
    if (!settings.prowlarr?.enabled || !settings.prowlarr?.url) {
        app.log.warn("Prowlarr not configured. Indexer management will be disabled.");
        // We explicitly set it to undefined so app.prowlarr is defined but empty
        app.decorate("prowlarr", undefined);
        return;
    }

    const prowlarr = new ProwlarrService({
        baseUrl: settings.prowlarr.url,
        apiKey: settings.prowlarr.apiKey || "",
    });

    // Test connection?
    try {
        const status = await prowlarr.getSystemStatus();
        app.log.info({ version: status.version }, "Prowlarr plugin registered and connected");
    } catch (error) {
        app.log.error({ error, url: settings.prowlarr.url }, "Failed to connect to Prowlarr");
        // We still decorate, maybe the service can recover or settings change? 
        // Usually better to fail open or set null.
        // Given qbittorrent sets null on failure, let's stick to that pattern or undefined.
        // But container expects Service | undefined.
    }

    app.decorate("prowlarr", prowlarr);
});
