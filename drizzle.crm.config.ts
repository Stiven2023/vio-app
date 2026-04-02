import type { Config } from "drizzle-kit";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", override: true });
loadEnv({ path: ".env.local", override: true });

const url = process.env.CRM_DATABASE_URL;

if (!url) {
  throw new Error("Missing CRM_DATABASE_URL for Drizzle CRM config.");
}

export default {
  schema: "./src/db/crm/schema.ts",
  out: "./drizzle/crm",
  dialect: "postgresql",
  dbCredentials: { url },
} satisfies Config;
