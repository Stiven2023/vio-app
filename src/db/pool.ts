import { Pool } from "pg";

type DbPoolMap = {
  erpPool?: Pool;
  mesPool?: Pool;
  crmPool?: Pool;
  iamPool?: Pool;
};

const globalForDb = globalThis as unknown as DbPoolMap;

export function getOrCreatePool(cacheKey: keyof DbPoolMap, connectionString: string): Pool {
  const existing = globalForDb[cacheKey];

  if (existing) {
    return existing;
  }

  const created = new Pool({ connectionString });

  if (process.env.NODE_ENV !== "production") {
    globalForDb[cacheKey] = created;
  }

  return created;
}
