import type { Config } from "drizzle-kit";
import { resolve } from "path";

export default {
  // In production, schema is in ./dist/schema.ts, in development it's ./src/schema.ts
  schema: process.env.NODE_ENV === "production" ? "./dist/schema.ts" : "./src/schema.ts",
  out: "./src/migrations",
  dialect: "sqlite",
  dbCredentials: {
    // Use DATABASE_PATH env var if set, otherwise use workspace root relative path
    url: process.env.DATABASE_PATH || resolve(__dirname, "../../data/app.db"),
  },
} satisfies Config;











