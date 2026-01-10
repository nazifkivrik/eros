import fp from "fastify-plugin";
import { createDatabase, type Database } from "@repo/database";
import { mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

export default fp(async (app) => {
  // Use DATABASE_PATH env var if set, otherwise use workspace root relative path
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const databasePath = process.env.DATABASE_PATH || resolve(__dirname, "../../../data/app.db");

  app.log.info(`Connecting to database at ${databasePath}`);

  // Ensure the directory exists
  const dbDir = dirname(databasePath);
  if (!existsSync(dbDir)) {
    app.log.info(`Creating database directory: ${dbDir}`);
    await mkdir(dbDir, { recursive: true });
  }

  // createDatabase is now async - runs migrations automatically
  const db = await createDatabase(databasePath);

  app.decorate("db", db);

  app.log.info("Database connected successfully");
});











