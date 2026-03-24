import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pool?: Pool;
};

function normalizeDatabaseUrl(raw: string | undefined) {
  if (!raw) return raw;

  try {
    const url = new URL(raw);
    const sslmode = (url.searchParams.get("sslmode") ?? "").toLowerCase();
    const useLibpqCompat =
      (url.searchParams.get("uselibpqcompat") ?? "").toLowerCase() ===
      "true";

    // Keep current strict TLS semantics and silence pg-connection-string warning.
    if (
      !useLibpqCompat &&
      (sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca")
    ) {
      url.searchParams.set("sslmode", "verify-full");
    }

    return url.toString();
  } catch {
    return raw;
  }
}

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
