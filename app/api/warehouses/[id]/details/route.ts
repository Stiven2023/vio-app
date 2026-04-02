import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryItemVariants,
  inventoryItems,
  stockMovements,
  warehouseStock,
  warehouses,
} from "@/src/db/erp/schema";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const limited = rateLimit(request, {
    key: "warehouses:details:get",
    limit: 240,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);
  const allowedRole = role === "ADMINISTRADOR" || role === "LIDER_SUMINISTROS";

  if (!allowedRole) return new Response("Forbidden", { status: 403 });

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const warehouseId = String(id ?? "").trim();

  if (!warehouseId)
    return new Response("warehouse id required", { status: 400 });

  const [warehouse] = await db
    .select({
      id: warehouses.id,
      code: warehouses.code,
      name: warehouses.name,
      description: warehouses.description,
      purpose: warehouses.purpose,
      isVirtual: warehouses.isVirtual,
      isExternal: warehouses.isExternal,
      address: warehouses.address,
      city: warehouses.city,
      department: warehouses.department,
      isActive: warehouses.isActive,
      createdAt: warehouses.createdAt,
    })
    .from(warehouses)
    .where(eq(warehouses.id, warehouseId))
    .limit(1);

  if (!warehouse) return new Response("Not found", { status: 404 });

  const products = await db
    .select({
      stockId: warehouseStock.id,
      inventoryItemId: sql<
        string | null
      >`coalesce(${warehouseStock.inventoryItemId}, ${inventoryItemVariants.inventoryItemId})`,
      variantId: warehouseStock.variantId,
      itemCode: inventoryItems.itemCode,
      itemName: inventoryItems.name,
      variantSku: inventoryItemVariants.sku,
      variantColor: inventoryItemVariants.color,
      variantSize: inventoryItemVariants.size,
      availableQty: warehouseStock.availableQty,
      reservedQty: warehouseStock.reservedQty,
      minStock: warehouseStock.minStock,
      lastUpdated: warehouseStock.lastUpdated,
    })
    .from(warehouseStock)
    .leftJoin(
      inventoryItemVariants,
      eq(warehouseStock.variantId, inventoryItemVariants.id),
    )
    .leftJoin(
      inventoryItems,
      sql`${inventoryItems.id} = coalesce(${warehouseStock.inventoryItemId}, ${inventoryItemVariants.inventoryItemId})`,
    )
    .where(eq(warehouseStock.warehouseId, warehouseId))
    .orderBy(desc(warehouseStock.lastUpdated));

  const mappedProducts = products.map((row) => ({
    stockId: row.stockId,
    inventoryItemId: row.inventoryItemId,
    variantId: row.variantId,
    itemCode: row.itemCode,
    itemName: row.itemName,
    variantSku: row.variantSku,
    variantColor: row.variantColor,
    variantSize: row.variantSize,
    availableQty: row.availableQty,
    reservedQty: row.reservedQty,
    minStock: row.minStock,
    lastUpdated: row.lastUpdated,
  }));

  const entries = await db
    .select({
      id: stockMovements.id,
      createdAt: stockMovements.createdAt,
      quantity: stockMovements.quantity,
      reason: stockMovements.reason,
      notes: stockMovements.notes,
      itemCode: inventoryItems.itemCode,
      itemName: inventoryItems.name,
      variantSku: inventoryItemVariants.sku,
      variantColor: inventoryItemVariants.color,
      variantSize: inventoryItemVariants.size,
      fromWarehouseId: stockMovements.fromWarehouseId,
    })
    .from(stockMovements)
    .leftJoin(
      inventoryItems,
      eq(stockMovements.inventoryItemId, inventoryItems.id),
    )
    .leftJoin(
      inventoryItemVariants,
      eq(stockMovements.variantId, inventoryItemVariants.id),
    )
    .where(
      and(
        eq(stockMovements.toWarehouseId, warehouseId),
        sql`${stockMovements.movementType} in ('ENTRADA', 'TRASLADO', 'AJUSTE_POSITIVO', 'DEVOLUCION')`,
      ),
    )
    .orderBy(desc(stockMovements.createdAt))
    .limit(50);

  const outputs = await db
    .select({
      id: stockMovements.id,
      createdAt: stockMovements.createdAt,
      quantity: stockMovements.quantity,
      reason: stockMovements.reason,
      notes: stockMovements.notes,
      itemCode: inventoryItems.itemCode,
      itemName: inventoryItems.name,
      variantSku: inventoryItemVariants.sku,
      variantColor: inventoryItemVariants.color,
      variantSize: inventoryItemVariants.size,
      toWarehouseId: stockMovements.toWarehouseId,
    })
    .from(stockMovements)
    .leftJoin(
      inventoryItems,
      eq(stockMovements.inventoryItemId, inventoryItems.id),
    )
    .leftJoin(
      inventoryItemVariants,
      eq(stockMovements.variantId, inventoryItemVariants.id),
    )
    .where(
      and(
        eq(stockMovements.fromWarehouseId, warehouseId),
        sql`${stockMovements.movementType} in ('SALIDA', 'TRASLADO', 'AJUSTE_NEGATIVO', 'DEVOLUCION')`,
      ),
    )
    .orderBy(desc(stockMovements.createdAt))
    .limit(50);

  const warehouseIdSet = new Set<string>();

  for (const row of entries) {
    if (row.fromWarehouseId) warehouseIdSet.add(row.fromWarehouseId);
  }

  for (const row of outputs) {
    if (row.toWarehouseId) warehouseIdSet.add(row.toWarehouseId);
  }

  const relatedWarehouses = warehouseIdSet.size
    ? await db
        .select({
          id: warehouses.id,
          code: warehouses.code,
          name: warehouses.name,
        })
        .from(warehouses)
        .where(inArray(warehouses.id, Array.from(warehouseIdSet)))
    : [];

  const relatedMap = new Map(
    relatedWarehouses.map((w) => [w.id, { code: w.code, name: w.name }]),
  );

  const mappedEntries = entries.map((row) => ({
    ...row,
    fromWarehouseCode: row.fromWarehouseId
      ? (relatedMap.get(row.fromWarehouseId)?.code ?? null)
      : null,
    fromWarehouseName: row.fromWarehouseId
      ? (relatedMap.get(row.fromWarehouseId)?.name ?? null)
      : null,
  }));

  const mappedOutputs = outputs.map((row) => ({
    ...row,
    toWarehouseCode: row.toWarehouseId
      ? (relatedMap.get(row.toWarehouseId)?.code ?? null)
      : null,
    toWarehouseName: row.toWarehouseId
      ? (relatedMap.get(row.toWarehouseId)?.name ?? null)
      : null,
  }));

  return Response.json({
    warehouse,
    products: mappedProducts,
    entries: mappedEntries,
    outputs: mappedOutputs,
  });
}
