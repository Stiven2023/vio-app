function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `[db] Missing required environment variable: ${name}. ` +
        `Define it in .env or .env.local before starting the app.`,
    );
  }

  return value;
}

function normalizeDatabaseUrl(raw: string): string {
  try {
    const url = new URL(raw);

    // Keep sslmode exactly as provided by environment (.env, secret store, etc.).
    // Rewriting modes here can break local Postgres instances that do not support SSL.
    return url.toString();
  } catch {
    return raw;
  }
}

export const dbEnv = {
  ERP_DATABASE_URL: normalizeDatabaseUrl(requiredEnv("ERP_DATABASE_URL")),
  MES_DATABASE_URL: normalizeDatabaseUrl(requiredEnv("MES_DATABASE_URL")),
  CRM_DATABASE_URL: normalizeDatabaseUrl(requiredEnv("CRM_DATABASE_URL")),
  IAM_DATABASE_URL: normalizeDatabaseUrl(requiredEnv("IAM_DATABASE_URL")),
} as const;
