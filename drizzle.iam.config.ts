import type { Config } from "drizzle-kit";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", override: true });
loadEnv({ path: ".env.local", override: true });

const url = process.env.IAM_DATABASE_URL;

if (!url) {
  throw new Error("Missing IAM_DATABASE_URL for Drizzle IAM config.");
}

export default {
  schema: "./src/db/iam/schema.ts",
  out: "./drizzle/iam",
  dialect: "postgresql",
  dbCredentials: { url },
} satisfies Config;
