import { and, eq, sql } from "drizzle-orm";

import { inventory, inventoryEntries, inventoryOutputs } from "@/src/db/schema";

type InventoryLocation = "BODEGA_PRINCIPAL" | "TIENDA";

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

async function recomputeStock(
  dbOrTx: any,
  inventoryItemId: string,
  location?: InventoryLocation,
) {
  const entriesWhere = location
    ? and(
        eq(inventoryEntries.inventoryItemId, inventoryItemId),
        eq(inventoryEntries.location, location),
      )
    : eq(inventoryEntries.inventoryItemId, inventoryItemId);

  const [entriesRow] = await dbOrTx
    .select({
      total: sql<string>`coalesce(sum(${inventoryEntries.quantity}), 0)::text`,
    })
    .from(inventoryEntries)
    .where(entriesWhere);

  const outputsWhere = location
    ? and(
        eq(inventoryOutputs.inventoryItemId, inventoryItemId),
        eq(inventoryOutputs.location, location),
      )
    : eq(inventoryOutputs.inventoryItemId, inventoryItemId);

  const [outputsRow] = await dbOrTx
    .select({
      total: sql<string>`coalesce(sum(${inventoryOutputs.quantity}), 0)::text`,
    })
    .from(inventoryOutputs)
    .where(outputsWhere);

  return asNumber(entriesRow?.total) - asNumber(outputsRow?.total);
}

export async function computeStockForItem(
  dbOrTx: any,
  inventoryItemId: string,
  location?: InventoryLocation,
) {
  return recomputeStock(dbOrTx, inventoryItemId, location);
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
