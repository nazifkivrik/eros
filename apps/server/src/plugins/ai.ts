/**
 * AI Matching Plugin
 * Provides AI-powered semantic matching capabilities
 */

import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createAIMatchingService } from "../services/ai-matching.service.js";

const aiPlugin: FastifyPluginAsync = async (app) => {
  // Wait for plugins to be ready
  await app.after();

  // Get settings
  const { createSettingsService } = await import("../services/settings.service.js");
  const settingsService = createSettingsService(app.db);
  const settings = await settingsService.getSettings();

  if (!settings.ai.enabled) {
    app.log.info("AI matching is disabled");
    app.decorate("ai", null);
    return;
  }

  const aiService = createAIMatchingService();

  // Don't initialize on startup - lazy load when first used
  // This prevents blocking startup while downloading AI models
  app.log.info(
    {
      model: settings.ai.model,
      threshold: settings.ai.threshold,
    },
    "AI matching service registered (will initialize on first use)"
  );

  app.decorate("ai", aiService);
};

export default fp(aiPlugin, {
  name: "ai",
  timeout: 60000, // 60 seconds for AI model initialization
});

// Extend Fastify types
declare module "fastify" {
  interface FastifyInstance {
    ai: ReturnType<typeof createAIMatchingService> | null;
  }
}
