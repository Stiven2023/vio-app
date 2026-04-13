import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryItems,
  inventoryItemVariants,
  stockMovements,
  warehouseStock,
  warehouses,
} from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  jsonForbidden,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { warehouseInventoryOverviewQuerySchema } from "@/src/utils/warehouse-inventory-overview-contract";

function ensureWarehouseRole(request: Request) {
  const role = getRoleFromRequest(request);
  const allowed = role === "ADMINISTRADOR" || role === "LIDER_SUMINISTROS";

  return allowed
    ? null
    : jsonForbidden(
        "No tienes permisos para consultar el resumen de inventario multi-bodega.",
      );
}

const entryTypes = [
  "ENTRADA",
  "TRASLADO",
  "AJUSTE_POSITIVO",
  "DEVOLUCION",
] as const;
const outputTypes = [
  "SALIDA",
  "TRASLADO",
  "AJUSTE_NEGATIVO",
  "DEVOLUCION",
] as const;

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouses:inventory-overview:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const roleForbidden = ensureWarehouseRole(request);

  if (roleForbidden) return roleForbidden;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) {
    return jsonError(
      403,
      "FORBIDDEN",
      "No tienes permisos para consultar inventario.",
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = warehouseInventoryOverviewQuerySchema.safeParse({
    includeInactive: searchParams.get("includeInactive"),
  });

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Los filtros del resumen de inventario son inválidos.",
    );
  }

  const { includeInactive } = parsed.data;

  try {
    const warehouseRows = await db
      .select({
        id: warehouses.id,
        code: warehouses.code,
        name: warehouses.name,
        purpose: warehouses.purpose,
        isActive: warehouses.isActive,
      })
      .from(warehouses)
      .where(includeInactive ? undefined : eq(warehouses.isActive, true))
      .orderBy(desc(warehouses.createdAt));

    const warehouseIds = warehouseRows.map((row) => row.id);

    if (warehouseIds.length === 0) {
      return Response.json({
        warehouses: [],
        detailsByWarehouse: {},
        pricesByItemCode: {},
      });
    }

    const products = await db
      .select({
        warehouseId: warehouseStock.warehouseId,
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
      .where(inArray(warehouseStock.warehouseId, warehouseIds))
      .orderBy(desc(warehouseStock.lastUpdated));

    const entryRows = await db
      .select({
        warehouseId: stockMovements.toWarehouseId,
        id: stockMovements.id,
        createdAt: stockMovements.createdAt,
        quantity: stockMovements.quantity,
        reason: stockMovements.reason,
        notes: stockMovements.notes,
        itemCode: inventoryItems.itemCode,
        itemName: inventoryItems.name,
        variantSku: inventoryItemVariants.sku,
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
          inArray(stockMovements.toWarehouseId, warehouseIds),
          inArray(stockMovements.movementType, entryTypes),
        ),
      )
      .orderBy(desc(stockMovements.createdAt))
      .limit(400);

    const outputRows = await db
      .select({
        warehouseId: stockMovements.fromWarehouseId,
        id: stockMovements.id,
        createdAt: stockMovements.createdAt,
        quantity: stockMovements.quantity,
        reason: stockMovements.reason,
        notes: stockMovements.notes,
        itemCode: inventoryItems.itemCode,
        itemName: inventoryItems.name,
        variantSku: inventoryItemVariants.sku,
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
          inArray(stockMovements.fromWarehouseId, warehouseIds),
          inArray(stockMovements.movementType, outputTypes),
        ),
      )
      .orderBy(desc(stockMovements.createdAt))
      .limit(400);

    const relatedWarehouseIds = new Set<string>();

    for (const row of entryRows) {
      if (row.fromWarehouseId) relatedWarehouseIds.add(row.fromWarehouseId);
    }

    for (const row of outputRows) {
      if (row.toWarehouseId) relatedWarehouseIds.add(row.toWarehouseId);
    }

    const relatedWarehouses = relatedWarehouseIds.size
      ? await db
          .select({
            id: warehouses.id,
            code: warehouses.code,
            name: warehouses.name,
          })
          .from(warehouses)
          .where(inArray(warehouses.id, Array.from(relatedWarehouseIds)))
      : [];

    const relatedMap = new Map(
      relatedWarehouses.map((row) => [
        row.id,
        { code: row.code, name: row.name },
      ]),
    );

    const itemCodes = new Set<string>();

    for (const row of products) {
      if (row.itemCode) itemCodes.add(row.itemCode);
    }

    const priceRows = itemCodes.size
      ? await db
          .select({
            itemCode: inventoryItems.itemCode,
            price: inventoryItems.price,
          })
          .from(inventoryItems)
          .where(inArray(inventoryItems.itemCode, Array.from(itemCodes)))
      : [];

    const pricesByItemCode: Record<string, string> = {};

    for (const row of priceRows) {
      pricesByItemCode[row.itemCode] = String(row.price ?? "0");
    }

    const detailsByWarehouse: Record<
      string,
      {
        products: Array<{
          stockId: string;
          inventoryItemId: string | null;
          variantId: string | null;
          itemCode: string | null;
          itemName: string | null;
          variantSku: string | null;
          variantColor: string | null;
          variantSize: string | null;
          availableQty: string | null;
        }>;
        entries: Array<{
          id: string;
          createdAt: Date | null;
          quantity: string | null;
          reason: string | null;
          notes: string | null;
          itemCode: string | null;
          itemName: string | null;
          variantSku: string | null;
          fromWarehouseName: string | null;
        }>;
        outputs: Array<{
          id: string;
          createdAt: Date | null;
          quantity: string | null;
          reason: string | null;
          notes: string | null;
          itemCode: string | null;
          itemName: string | null;
          variantSku: string | null;
          toWarehouseName: string | null;
        }>;
      }
    > = {};

    for (const warehouse of warehouseRows) {
      detailsByWarehouse[warehouse.id] = {
        products: [],
        entries: [],
        outputs: [],
      };
    }

    for (const row of products) {
      if (!row.warehouseId) continue;

      detailsByWarehouse[row.warehouseId]?.products.push({
        stockId: row.stockId,
        inventoryItemId: row.inventoryItemId,
        variantId: row.variantId,
        itemCode: row.itemCode,
        itemName: row.itemName,
        variantSku: row.variantSku,
        variantColor: row.variantColor,
        variantSize: row.variantSize,
        availableQty: row.availableQty,
      });
    }

    for (const row of entryRows) {
      if (!row.warehouseId) continue;

      detailsByWarehouse[row.warehouseId]?.entries.push({
        id: row.id,
        createdAt: row.createdAt,
        quantity: row.quantity,
        reason: row.reason,
        notes: row.notes,
        itemCode: row.itemCode,
        itemName: row.itemName,
        variantSku: row.variantSku,
        fromWarehouseName: row.fromWarehouseId
          ? (relatedMap.get(row.fromWarehouseId)?.name ?? null)
          : null,
      });
    }

    for (const row of outputRows) {
      if (!row.warehouseId) continue;

      detailsByWarehouse[row.warehouseId]?.outputs.push({
        id: row.id,
        createdAt: row.createdAt,
        quantity: row.quantity,
        reason: row.reason,
        notes: row.notes,
        itemCode: row.itemCode,
        itemName: row.itemName,
        variantSku: row.variantSku,
        toWarehouseName: row.toWarehouseId
          ? (relatedMap.get(row.toWarehouseId)?.name ?? null)
          : null,
      });
    }

    return Response.json({
      warehouses: warehouseRows,
      detailsByWarehouse,
      pricesByItemCode,
    });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudo consultar el resumen de inventario multi-bodega.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo consultar el resumen de inventario multi-bodega.",
    );
  }
}
