import fp from "fastify-plugin";
import { StashDBService } from "../services/stashdb.service.js";

declare module "fastify" {
  interface FastifyInstance {
    stashdb: StashDBService;
  }
}

export default fp(async (app) => {
  const apiUrl = process.env.STASHDB_API_URL || "https://stashdb.org/graphql";
  const apiKey = process.env.STASHDB_API_KEY;

  if (!apiKey) {
    app.log.warn("StashDB API Key not configured. StashDB service will be limited.");
  }

  const stashdb = new StashDBService({
    apiUrl,
    apiKey,
  });

  app.decorate("stashdb", stashdb);

  app.log.info("StashDB plugin registered", { apiUrl, hasApiKey: !!apiKey });
});

