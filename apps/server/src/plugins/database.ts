import fp from "fastify-plugin";
import { createDatabase, type Database } from "@repo/database";
import { mkdir } from "fs/promises";
import { dirname } from "path";
import { existsSync } from "fs";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

export default fp(async (app) => {
  const databasePath = process.env.DATABASE_PATH || "./data/app.db";

  app.log.info(`Connecting to database at ${databasePath}`);

  // Ensure the directory exists
  const dbDir = dirname(databasePath);
  if (!existsSync(dbDir)) {
    app.log.info(`Creating database directory: ${dbDir}`);
    await mkdir(dbDir, { recursive: true });
  }

  const db = createDatabase(databasePath);

  app.decorate("db", db);

  app.log.info("Database connected successfully");
});











