import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";

import databasePlugin from "./plugins/database.js";
import authPlugin from "./plugins/auth.js";
import swaggerPlugin from "./plugins/swagger.js";
import containerPlugin from "./plugins/container.js";

import authRoutes from "./modules/auth/auth.routes.js";
import setupRoutes from "./modules/setup/setup.routes.js";
import searchRoutes from "./modules/search/search.routes.js";
import performersRoutes from "./modules/performers/performers.routes.js";
import qualityProfilesRoutes from "./modules/quality-profiles/quality-profiles.routes.js";
import subscriptionsRoutes from "./modules/subscriptions/subscriptions.routes.js";
import downloadQueueRoutes from "./modules/download-queue/download-queue.routes.js";
import jobsRoutes from "./modules/jobs/jobs.routes.js";
import torrentsRoutes from "./modules/torrents/torrents.routes.js";
import torrentSearchRoutes from "./modules/torrent-search/torrent-search.routes.js";
import logsRoutes from "./modules/logs/logs.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Setup Zod validation
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register core plugins
  await app.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true, // Allow cookies
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });
  await app.register(sensible);
  await app.register(swaggerPlugin);

  // Register infrastructure plugins
  await app.register(databasePlugin);
  await app.register(authPlugin);

  // Register DI container (must be after infrastructure plugins)
  await app.register(containerPlugin);

  // Register modules
  await app.register(setupRoutes, { prefix: "/api/setup" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(searchRoutes, { prefix: "/api/search" });
  await app.register(performersRoutes, { prefix: "/api/performers" });
  await app.register(qualityProfilesRoutes, {
    prefix: "/api/quality-profiles",
  });
  await app.register(subscriptionsRoutes, { prefix: "/api/subscriptions" });
  await app.register(downloadQueueRoutes, { prefix: "/api/download-queue" });
  await app.register(jobsRoutes, { prefix: "/api/jobs" });
  await app.register(torrentsRoutes, { prefix: "/api/torrents" });
  await app.register(torrentSearchRoutes, { prefix: "/api/torrent-search" });
  await app.register(logsRoutes, { prefix: "/api/logs" });
  await app.register(settingsRoutes, { prefix: "/api/settings" });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
