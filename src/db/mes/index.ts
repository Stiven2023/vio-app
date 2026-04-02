import { drizzle } from "drizzle-orm/node-postgres";

import { dbEnv } from "../env";
import { getOrCreatePool } from "../pool";
import * as schema from "./schema";

const pool = getOrCreatePool("mesPool", dbEnv.MES_DATABASE_URL);

export const mesDb = drizzle(pool, { schema });
