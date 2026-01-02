// Only load .env in development
if (process.env.NODE_ENV !== "production") {
  const { config } = await import("dotenv");
  const { resolve } = await import("path");
  const { fileURLToPath } = await import("url");
  const { dirname } = await import("path");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const rootDir = resolve(__dirname, "../../../");
  config({ path: resolve(rootDir, ".env") });
}

import { buildApp } from "./app.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`🚀 Server is running on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
