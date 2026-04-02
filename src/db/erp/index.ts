import { drizzle } from "drizzle-orm/node-postgres";

import { dbEnv } from "../env";
import { getOrCreatePool } from "../pool";

import * as schema from "./schema";

const pool = getOrCreatePool("erpPool", dbEnv.ERP_DATABASE_URL);

export const erpDb = drizzle(pool, { schema });
