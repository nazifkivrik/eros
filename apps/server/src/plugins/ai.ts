/**
 * AI Matching Plugin
 * Provides AI-powered semantic matching capabilities
 */

import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createAIMatchingService } from "../services/ai-matching.service.js";

const aiPlugin: FastifyPluginAsync = async (app) => {
  const aiEnabled = process.env.AI_MATCHING_ENABLED !== "false";

  if (!aiEnabled) {
    app.log.info("AI matching is disabled");
    app.decorate("ai", null);
    return;
  }

  const aiService = createAIMatchingService();

  // Initialize the AI model on startup
  try {
    app.log.info("Initializing AI matching service...");
    await aiService.initialize();
    app.log.info("AI matching service initialized successfully");
  } catch (error) {
    app.log.error(
      { error },
      "Failed to initialize AI matching service - AI features will be disabled"
    );
    app.decorate("ai", null);
    return;
  }

  app.decorate("ai", aiService);

  app.log.info("AI matching plugin registered");
};

export default fp(aiPlugin, {
  name: "ai",
});

// Extend Fastify types
declare module "fastify" {
  interface FastifyInstance {
    ai: ReturnType<typeof createAIMatchingService> | null;
  }
}
