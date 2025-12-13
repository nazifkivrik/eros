import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH || "./data/app.db",
  },
} satisfies Config;










