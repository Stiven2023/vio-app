import { drizzle } from "drizzle-orm/node-postgres";

import { dbEnv } from "../env";
import { getOrCreatePool } from "../pool";

import { crmSchema } from "./schema";

const pool = getOrCreatePool("crmPool", dbEnv.CRM_DATABASE_URL);

export const crmDb = drizzle(pool, { schema: crmSchema });
