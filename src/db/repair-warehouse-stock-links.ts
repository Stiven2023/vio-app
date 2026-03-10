/* eslint-disable no-console */

import "dotenv/config";
import { sql } from "drizzle-orm";

import { db } from "./index";

async function main() {
  const beforeResult = await db.execute(sql<{
    null_item_count: number;
    null_item_with_variant_count: number;
    orphan_count: number;
  }>`
    select
      count(*) filter (where inventory_item_id is null) as null_item_count,
      count(*) filter (where inventory_item_id is null and variant_id is not null) as null_item_with_variant_count,
      count(*) filter (where inventory_item_id is null and variant_id is null) as orphan_count
    from warehouse_stock
  `);

  const before = beforeResult.rows?.[0] ?? {
    null_item_count: 0,
    null_item_with_variant_count: 0,
    orphan_count: 0,
  };

  console.log("Before repair:", before);

  await db.execute(sql`
    update warehouse_stock ws
    set inventory_item_id = iv.inventory_item_id
    from inventory_item_variants iv
    where ws.inventory_item_id is null
      and ws.variant_id = iv.id
  `);

  await db.execute(sql`
    delete from warehouse_stock
    where inventory_item_id is null
      and variant_id is null
  `);

  const afterResult = await db.execute(sql<{
    null_item_count: number;
    null_item_with_variant_count: number;
    orphan_count: number;
  }>`
    select
      count(*) filter (where inventory_item_id is null) as null_item_count,
      count(*) filter (where inventory_item_id is null and variant_id is not null) as null_item_with_variant_count,
      count(*) filter (where inventory_item_id is null and variant_id is null) as orphan_count
    from warehouse_stock
  `);

  const after = afterResult.rows?.[0] ?? {
    null_item_count: 0,
    null_item_with_variant_count: 0,
    orphan_count: 0,
  };

  console.log("After repair:", after);
}

main()
  .then(() => {
    console.log("warehouse_stock repair complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("warehouse_stock repair failed", error);
    process.exit(1);
  });
