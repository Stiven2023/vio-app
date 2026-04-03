import "dotenv/config";

import { Client } from "pg";

async function main() {
  const url = process.env.ERP_DATABASE_URL;

  if (!url) {
    throw new Error("ERP_DATABASE_URL missing");
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const enumNames = [
    "cash_receipt_status",
    "payment_method",
    "factoring_status",
    "legal_status_status",
  ];

  const enumResult = await client.query<{
    typname: string;
    enumlabel: string;
    enumsortorder: number;
  }>(`
    select t.typname, e.enumlabel, e.enumsortorder
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = any($1::text[])
    order by t.typname, e.enumsortorder;
  `, [enumNames]);

  const depResult = await client.query<{
    typname: string;
    table_name: string;
    column_name: string;
  }>(`
    select
      t.typname,
      c.table_name,
      c.column_name
    from information_schema.columns c
    join pg_type t on t.typname = c.udt_name
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and c.table_schema = 'public'
      and t.typname = any($1::text[])
    order by t.typname, c.table_name, c.column_name;
  `, [enumNames]);

  console.log("== ENUM LABELS ==");
  for (const enumName of enumNames) {
    const labels = enumResult.rows
      .filter((row) => row.typname === enumName)
      .map((row) => row.enumlabel);
    console.log(`${enumName}: [${labels.join(", ")}]`);
  }

  console.log("== DEPENDENCIES ==");
  for (const row of depResult.rows) {
    console.log(`${row.typname} -> ${row.table_name}.${row.column_name}`);
  }

  await client.end();
}

void main();
