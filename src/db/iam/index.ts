import { drizzle } from "drizzle-orm/node-postgres";

import { dbEnv } from "../env";
import { getOrCreatePool } from "../pool";

import * as schema from "./schema";

const pool = getOrCreatePool("iamPool", dbEnv.IAM_DATABASE_URL);

export const iamDb = drizzle(pool, { schema });
