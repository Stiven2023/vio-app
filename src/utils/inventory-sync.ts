import { eq, sql } from "drizzle-orm";

import { inventory, inventoryEntries, inventoryOutputs } from "@/src/db/schema";

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

async function recomputeStock(dbOrTx: any, inventoryItemId: string) {
  const [entriesRow] = await dbOrTx
    .select({
      total: sql<string>`coalesce(sum(${inventoryEntries.quantity}), 0)::text`,
    })
    .from(inventoryEntries)
    .where(eq(inventoryEntries.inventoryItemId, inventoryItemId));

  const [outputsRow] = await dbOrTx
    .select({
      total: sql<string>`coalesce(sum(${inventoryOutputs.quantity}), 0)::text`,
    })
    .from(inventoryOutputs)
    .where(eq(inventoryOutputs.inventoryItemId, inventoryItemId));

  return asNumber(entriesRow?.total) - asNumber(outputsRow?.total);
}

export async function computeStockForItem(dbOrTx: any, inventoryItemId: string) {
  return recomputeStock(dbOrTx, inventoryItemId);
}

export async function syncInventoryForItem(dbOrTx: any, inventoryItemId: string) {
  const id = String(inventoryItemId ?? "").trim();
  if (!id) return;

  const stock = await computeStockForItem(dbOrTx, id);

  const [existing] = await dbOrTx
    .select({ id: inventory.id })
    .from(inventory)
    .where(eq(inventory.inventoryItemId, id))
    .limit(1);

  if (!existing) {
    await dbOrTx.insert(inventory).values({
      inventoryItemId: id,
      availableQty: String(stock),
      lastUpdated: new Date(),
      updatedAt: new Date(),
    });

    return;
  }

  await dbOrTx
    .update(inventory)
    .set({
      availableQty: String(stock),
      lastUpdated: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(inventory.inventoryItemId, id));
}
