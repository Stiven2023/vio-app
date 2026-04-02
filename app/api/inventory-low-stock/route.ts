import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryCategories,
  inventoryItemVariants,
  inventoryItems,
  suppliers,
  warehouseStock,
  warehouses,
} from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

/**
 * GET /api/inventory-low-stock
 *
 * Returns items/variants where availableQty <= minStock (and minStock > 0).
 * Used by the purchases module to trigger purchase orders for restocking.
 *
 * Optional query params:
 *   - warehouseId: filter by specific warehouse
 *   - categoryType: filter by inventory category type
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-low-stock:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const warehouseIdFilter = String(
      searchParams.get("warehouseId") ?? "",
    ).trim();
    const categoryTypeFilter = String(
      searchParams.get("categoryType") ?? "",
    ).trim();

    const rows = await db
      .select({
        stockId: warehouseStock.id,
        warehouseId: warehouseStock.warehouseId,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        warehousePurpose: warehouses.purpose,
        inventoryItemId: inventoryItems.id,
        itemCode: inventoryItems.itemCode,
        itemName: inventoryItems.name,
        unit: inventoryItems.unit,
        itemPrice: inventoryItems.price,
        defaultSupplierId: inventoryItems.supplierId,
        defaultSupplierName: suppliers.name,
        categoryType: inventoryCategories.type,
        categoryName: inventoryCategories.name,
        variantId: warehouseStock.variantId,
        variantSku: inventoryItemVariants.sku,
        variantColor: inventoryItemVariants.color,
        variantSize: inventoryItemVariants.size,
        variantSupplierId: inventoryItemVariants.supplierId,
        variantUnitPrice: inventoryItemVariants.unitPrice,
        availableQty: warehouseStock.availableQty,
        minStock: warehouseStock.minStock,
        deficit: sql<string>`(${warehouseStock.minStock} - ${warehouseStock.availableQty})::text`,
      })
      .from(warehouseStock)
      .innerJoin(warehouses, eq(warehouseStock.warehouseId, warehouses.id))
      .leftJoin(
        inventoryItems,
        eq(warehouseStock.inventoryItemId, inventoryItems.id),
      )
      .leftJoin(
        inventoryCategories,
        eq(inventoryItems.categoryId, inventoryCategories.id),
      )
      .leftJoin(suppliers, eq(inventoryItems.supplierId, suppliers.id))
      .leftJoin(
        inventoryItemVariants,
        eq(warehouseStock.variantId, inventoryItemVariants.id),
      )
      .where(
        and(
          gt(warehouseStock.minStock, "0"),
          sql`${warehouseStock.availableQty} <= ${warehouseStock.minStock}`,
          warehouseIdFilter
            ? eq(warehouseStock.warehouseId, warehouseIdFilter)
            : undefined,
          categoryTypeFilter
            ? eq(
                inventoryCategories.type,
                categoryTypeFilter as typeof inventoryCategories.$inferSelect.type,
              )
            : undefined,
        ),
      )
      .orderBy(warehouses.name, inventoryItems.name);

    return Response.json({ items: rows, total: rows.length });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo consultar stock bajo", { status: 500 });
  }
}
