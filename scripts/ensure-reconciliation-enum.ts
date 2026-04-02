import "dotenv/config";

import { Client } from "pg";

async function main() {
  const url = process.env.ERP_DATABASE_URL;

  if (!url) {
    throw new Error("ERP_DATABASE_URL missing");
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  await client.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'reconciliation_item_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.reconciliation_item_type AS ENUM (
      'DEPOSIT_IN_TRANSIT',
      'OUTSTANDING_CHECK',
      'BANK_DEBIT_NOTE',
      'BANK_CREDIT_NOTE',
      'ACCOUNTING_ERROR',
      'BANK_ERROR'
    );
  END IF;
END
$$;
`);

  await client.end();
  console.log("enum reconciliation_item_type ensured");
}

void main();
