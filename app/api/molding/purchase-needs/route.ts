import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryItemVariants,
  inventoryItems,
  orderItemMoldingInsumos,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

/**
 * GET /api/molding/purchase-needs
 *
 * Returns a grouped list of insumos where qtyToPurchase > 0.
 * Used by the purchases module to auto-generate purchase orders.
 *
 * Step 6: COMPRAS integration – query order_item_molding_insumos
 * WHERE qtyToPurchase > 0 GROUP BY inventoryItemId
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "molding-purchase-needs:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MOLDERIA");

  if (forbidden) return forbidden;

  try {
    // Get all insumos with pending purchases (not yet requested)
    const rows = await db
      .select({
        inventoryItemId: orderItemMoldingInsumos.inventoryItemId,
        inventoryItemName: inventoryItems.name,
        inventoryItemUnit: inventoryItems.unit,
        variantId: orderItemMoldingInsumos.variantId,
        variantSku: inventoryItemVariants.sku,
        totalQtyToPurchase: sql<number>`sum(${orderItemMoldingInsumos.qtyToPurchase}::numeric)`,
        pendingInsumoCount: sql<number>`count(${orderItemMoldingInsumos.id})::int`,
      })
      .from(orderItemMoldingInsumos)
      .leftJoin(
        inventoryItems,
        eq(orderItemMoldingInsumos.inventoryItemId, inventoryItems.id),
      )
      .leftJoin(
        inventoryItemVariants,
        eq(orderItemMoldingInsumos.variantId, inventoryItemVariants.id),
      )
      .where(
        and(
          gt(orderItemMoldingInsumos.qtyToPurchase, "0"),
          eq(orderItemMoldingInsumos.status, "PENDIENTE"),
        ),
      )
      .groupBy(
        orderItemMoldingInsumos.inventoryItemId,
        inventoryItems.name,
        inventoryItems.unit,
        orderItemMoldingInsumos.variantId,
        inventoryItemVariants.sku,
      );

    return Response.json({ items: rows });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Could not retrieve purchase needs", { status: 500 });
  }
}
