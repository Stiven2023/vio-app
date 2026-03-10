import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryItemVariants,
  stockMovements,
  warehouses,
} from "@/src/db/schema";
import {
  computeStockForItemInWarehouse,
  computeStockForVariantInWarehouse,
  syncInventoryForItem,
  syncInventoryForVariant,
} from "@/src/utils/inventory-sync";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function toPositiveNumber(v: unknown) {
  const n = Number(String(v));

  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouse-transfers:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_SALIDA");
  if (forbidden) return forbidden;

  const {
    inventoryItemId,
    variantId,
    fromWarehouseId,
    toWarehouseId,
    quantity,
    notes,
  } = await request.json();

  const itemId = String(inventoryItemId ?? "").trim();
    const vId = String(variantId ?? "").trim();
  const fromId = String(fromWarehouseId ?? "").trim();
  const toId = String(toWarehouseId ?? "").trim();
  const qty = toPositiveNumber(quantity);
  const transferNotes = String(notes ?? "").trim();

  if (!itemId) return new Response("inventoryItemId required", { status: 400 });
  if (!fromId) return new Response("fromWarehouseId required", { status: 400 });
  if (!toId) return new Response("toWarehouseId required", { status: 400 });
  if (fromId === toId) {
    return new Response("source and destination must be different", { status: 400 });
  }
  if (!qty) return new Response("quantity must be positive", { status: 400 });

  const [fromWarehouse, toWarehouse] = await Promise.all([
    db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(eq(warehouses.id, fromId))
      .limit(1),
    db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(eq(warehouses.id, toId))
      .limit(1),
  ]);

  if (!fromWarehouse[0] || !toWarehouse[0]) {
    return new Response("warehouse not found", { status: 404 });
  }

  if (vId) {
    const [variantRow] = await db
      .select({ id: inventoryItemVariants.id })
      .from(inventoryItemVariants)
      .where(
        and(
          eq(inventoryItemVariants.id, vId),
          eq(inventoryItemVariants.inventoryItemId, itemId),
        ),
      )
      .limit(1);

    if (!variantRow) return new Response("variant not found", { status: 404 });
  }

  const available = vId
    ? await computeStockForVariantInWarehouse(db, vId, fromId)
    : await computeStockForItemInWarehouse(db, itemId, fromId);

  if (!Number.isFinite(available) || qty > available) {
    return new Response("Stock insuficiente en bodega origen", { status: 400 });
  }

  const created = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(stockMovements)
      .values({
        movementType: "TRASLADO",
        reason: "TRASLADO_INTERNO",
        notes: transferNotes || null,
        inventoryItemId: itemId,
        variantId: vId || null,
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        quantity: String(qty),
        referenceType: "MANUAL",
        referenceId: null,
      })
      .returning();

    await syncInventoryForItem(tx, itemId);
  if (vId) await syncInventoryForVariant(tx, vId);

    return rows;
  });

  return Response.json(created, { status: 201 });
}
