import type { Config } from "drizzle-kit";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", override: true });
loadEnv({ path: ".env.local", override: true });

const url = process.env.ERP_DATABASE_URL;

if (!url) {
  throw new Error("Missing ERP_DATABASE_URL for Drizzle ERP config.");
}

export default {
  schema: "./src/db/erp/schema.ts",
  out: "./drizzle/erp",
  dialect: "postgresql",
  dbCredentials: { url },
} satisfies Config;
