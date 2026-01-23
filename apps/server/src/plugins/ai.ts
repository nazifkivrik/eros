/**
 * AI Matching Plugin
 * Provides AI-powered semantic matching capabilities
 */

import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createAIMatchingService } from "../application/services/ai-matching/ai-matching.service.js";
import { SettingsRepository } from "../infrastructure/repositories/settings.repository.js";

const aiPlugin: FastifyPluginAsync = async (app) => {
  // Wait for plugins to be ready
  await app.after();

  // Get settings from database using repository
  const settingsRepository = new SettingsRepository({ db: app.db });
  const settingRecord = await settingsRepository.findByKey("app-settings");

  // Use default settings if none found
  const { DEFAULT_SETTINGS } = await import("@repo/shared-types");
  const settings = settingRecord
    ? (settingRecord.value as any)
    : DEFAULT_SETTINGS;

  if (!settings.ai.useCrossEncoder) {
    app.log.info("Cross-Encoder matching is disabled");
    app.decorate("ai", null);
    return;
  }

  const aiService = createAIMatchingService();

  // Don't initialize on startup - lazy load when first used
  // This prevents blocking startup while downloading AI models
  app.log.info(
    {
      useCrossEncoder: settings.ai.useCrossEncoder,
      crossEncoderThreshold: settings.ai.crossEncoderThreshold,
      unknownThreshold: settings.ai.unknownThreshold,
      groupingCount: settings.ai.groupingCount,
    },
    "Cross-Encoder matching service registered (will initialize on first use)"
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
