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
import tpdbPlugin from "./plugins/tpdb.js";
import qbittorrentPlugin from "./plugins/qbittorrent.js";
import schedulerPlugin from "./plugins/scheduler.js";
import aiPlugin from "./plugins/ai.js";
import fileManagerPlugin from "./plugins/file-manager.js";
// TODO: Implement these plugins in future phases
// import envPlugin from "./plugins/env";
// import settingsPlugin from "./plugins/settings";
// import subscriptionPlugin from "./plugins/subscription";
// import prowlarrPlugin from "./plugins/prowlarr";
// import parserPlugin from "./plugins/parser";
// import heuristicPlugin from "./plugins/heuristic";

import authRoutes from "./modules/auth/auth.routes.js";
import setupRoutes from "./modules/setup/setup.routes.js";
import searchRoutes from "./modules/search/search.routes.js";
import performersRoutes from "./modules/performers/performers.routes.js";
import qualityProfilesRoutes from "./modules/quality-profiles/quality-profiles.routes.js";
import subscriptionsRoutes from "./modules/subscriptions/subscriptions.routes.js";
import downloadQueueRoutes from "./modules/download-queue/download-queue.routes.js";
import jobsRoutes from "./modules/jobs/jobs.routes.js";
import torrentsRoutes from "./modules/torrents/torrents.routes.js";
import logsRoutes from "./modules/logs/logs.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";
// TODO: Implement these routes in future phases
// import entitiesRoutes from "./modules/entities/entities.routes";

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

  // Register infrastructure plugins
  await app.register(databasePlugin);
  await app.register(authPlugin);
  await app.register(tpdbPlugin);
  await app.register(qbittorrentPlugin);
  await app.register(fileManagerPlugin);
  await app.register(schedulerPlugin);
  await app.register(aiPlugin);
  // TODO: Register these plugins in future phases
  // await app.register(envPlugin);
  // await app.register(settingsPlugin);
  // await app.register(subscriptionPlugin);
  // await app.register(prowlarrPlugin);
  // await app.register(parserPlugin);
  // await app.register(heuristicPlugin);

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
  await app.register(logsRoutes, { prefix: "/api/logs" });
  await app.register(settingsRoutes, { prefix: "/api/settings" });
  // TODO: Register these routes in future phases
  // await app.register(entitiesRoutes, { prefix: "/api" });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
