import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

export default fp(async (app: FastifyInstance) => {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Eros API",
        description: "Adult content automation platform API - Manage performers, studios, scenes, subscriptions, and automated downloads",
        version: "0.1.0",
      },
      servers: [
        {
          url: "http://localhost:3001",
          description: "Development server",
        },
      ],
      components: {
        securitySchemes: {
          session: {
            type: "apiKey",
            in: "cookie",
            name: "sessionId",
            description: "Session-based authentication using cookies",
          },
        },
      },
      tags: [
        { name: "auth", description: "Authentication endpoints" },
        { name: "setup", description: "Initial setup and configuration" },
        { name: "search", description: "Search performers, studios, and scenes" },
        { name: "performers", description: "Performer management" },
        { name: "quality-profiles", description: "Quality profile configuration" },
        { name: "subscriptions", description: "Subscription management" },
        { name: "download-queue", description: "Download queue management" },
        { name: "jobs", description: "Background job management" },
        { name: "torrents", description: "Torrent operations" },
        { name: "logs", description: "Application logs" },
        { name: "settings", description: "Application settings" },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
  });

  app.log.info("Swagger documentation initialized at /docs");
});
