import "dotenv/config";

import { Client } from "pg";

async function main() {
  const url = process.env.ERP_DATABASE_URL;

  if (!url) {
    throw new Error("ERP_DATABASE_URL missing");
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const before = await client.query(`
    select count(*)::int as count
    from employees e
    left join roles r on r.id = e.role_id
    where e.role_id is not null and r.id is null;
  `);

  const repaired = await client.query(`
    with orphan_roles as (
      select distinct e.role_id
      from employees e
      left join roles r on r.id = e.role_id
      where e.role_id is not null and r.id is null
    )
    insert into roles (id, name)
    select
      o.role_id,
      'LEGACY_MIGRATED_ROLE_' || o.role_id::text
    from orphan_roles o
    on conflict (id) do nothing
    returning id;
  `);

  const after = await client.query(`
    select count(*)::int as count
    from employees e
    left join roles r on r.id = e.role_id
    where e.role_id is not null and r.id is null;
  `);

  console.log(`employees.role_id orphans before=${before.rows[0]?.count ?? 0}`);
  console.log(`roles inserted for orphans=${repaired.rowCount ?? 0}`);
  console.log(`employees.role_id orphans after=${after.rows[0]?.count ?? 0}`);

  await client.end();
}

void main();
