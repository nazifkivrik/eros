import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Load .env from workspace root (monorepo)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "../../../");
config({ path: resolve(rootDir, ".env") });

import { buildApp } from "./app.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
