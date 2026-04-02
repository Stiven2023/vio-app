import type { Config } from "drizzle-kit";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", override: true });
loadEnv({ path: ".env.local", override: true });

const url = process.env.MES_DATABASE_URL;

if (!url) {
  throw new Error("Missing MES_DATABASE_URL for Drizzle MES config.");
}

export default {
  schema: "./src/db/mes/schema.ts",
  out: "./drizzle/mes",
  dialect: "postgresql",
  dbCredentials: { url },
} satisfies Config;
