import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryItemVariants,
  inventoryItems,
  moldingTemplateInsumos,
  moldingTemplateSizeAdjustments,
  orderItemMoldingInsumos,
  orderItemMoldings,
  warehouseStock,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderItemId: string; moldingId: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-item-molding-insumos:get",
    limit: 150,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MOLDERIA");
  if (forbidden) return forbidden;

  const { moldingId } = await params;

  try {
    const insumos = await db
      .select({
        id: orderItemMoldingInsumos.id,
        orderItemMoldingId: orderItemMoldingInsumos.orderItemMoldingId,
        moldingTemplateInsumoId: orderItemMoldingInsumos.moldingTemplateInsumoId,
        inventoryItemId: orderItemMoldingInsumos.inventoryItemId,
        inventoryItemName: inventoryItems.name,
        variantId: orderItemMoldingInsumos.variantId,
        variantSku: inventoryItemVariants.sku,
        additionId: orderItemMoldingInsumos.additionId,
        size: orderItemMoldingInsumos.size,
        qtyRequired: orderItemMoldingInsumos.qtyRequired,
        qtyAvailable: orderItemMoldingInsumos.qtyAvailable,
        qtyToPurchase: orderItemMoldingInsumos.qtyToPurchase,
        unit: orderItemMoldingInsumos.unit,
        status: orderItemMoldingInsumos.status,
        notes: orderItemMoldingInsumos.notes,
        createdAt: orderItemMoldingInsumos.createdAt,
        updatedAt: orderItemMoldingInsumos.updatedAt,
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
      .where(eq(orderItemMoldingInsumos.orderItemMoldingId, moldingId))
      .orderBy(orderItemMoldingInsumos.createdAt);

    return Response.json({ items: insumos });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("Could not retrieve molding insumos", { status: 500 });
  }
}

/**
 * POST: Calculate and populate insumos for a molding from its template,
 * checking available stock and determining qtyToPurchase.
 * This is the "calculate" action that connects molding with purchases.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderItemId: string; moldingId: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-item-molding-insumos:post",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MOLDERIA");
  if (forbidden) return forbidden;

  const { moldingId } = await params;

  // Get the order item molding to find its template
  const [molding] = await db
    .select({
      id: orderItemMoldings.id,
      moldingTemplateId: orderItemMoldings.moldingTemplateId,
    })
    .from(orderItemMoldings)
    .where(eq(orderItemMoldings.id, moldingId))
    .limit(1);

  if (!molding) {
    return new Response("Order item molding not found", { status: 404 });
  }

  if (!molding.moldingTemplateId) {
    return new Response("This molding has no associated template", { status: 400 });
  }

  let body: { sizes?: string[] } = {};
  try {
    body = (await request.json()) as { sizes?: string[] };
  } catch {
    body = {};
  }

  const sizes: string[] = Array.isArray(body.sizes) && body.sizes.length > 0
    ? body.sizes
    : ["UNICO"];

  // Get template insumos
  const templateInsumos = await db
    .select()
    .from(moldingTemplateInsumos)
    .where(eq(moldingTemplateInsumos.moldingTemplateId, molding.moldingTemplateId));

  if (templateInsumos.length === 0) {
    return new Response("No insumos defined for this template", { status: 400 });
  }

  try {
    await db.transaction(async (tx) => {
      // Delete existing insumos for this molding
      await tx
        .delete(orderItemMoldingInsumos)
        .where(eq(orderItemMoldingInsumos.orderItemMoldingId, moldingId));

      const toInsert = [];

      for (const ti of templateInsumos) {
        const sizesToProcess = ti.variesBySize ? sizes : ["UNICO"];

        for (const size of sizesToProcess) {
          // Check if there's a size-specific adjustment
          let qtyRequired = Number(ti.qtyPerUnit);

          if (ti.variesBySize) {
            const [sizeAdj] = await tx
              .select()
              .from(moldingTemplateSizeAdjustments)
              .where(
                and(
                  eq(moldingTemplateSizeAdjustments.moldingTemplateInsumoId, ti.id),
                  eq(moldingTemplateSizeAdjustments.size, size),
                ),
              )
              .limit(1);

            if (sizeAdj) {
              qtyRequired = Number(sizeAdj.qtyPerUnit);
            }
          }

          // Check available stock across warehouses
          const stockRows = await tx
            .select({
              availableQty: warehouseStock.availableQty,
            })
            .from(warehouseStock)
            .where(
              and(
                eq(warehouseStock.inventoryItemId, ti.inventoryItemId),
                ti.variantId
                  ? eq(warehouseStock.variantId, ti.variantId)
                  : sql`${warehouseStock.variantId} is null`,
              ),
            );

          const totalAvailable = stockRows.reduce(
            (sum, r) => sum + Number(r.availableQty),
            0,
          );

          const qtyAvailable = Math.min(totalAvailable, qtyRequired);
          const qtyToPurchase = Math.max(0, qtyRequired - qtyAvailable);

          toInsert.push({
            orderItemMoldingId: moldingId,
            moldingTemplateInsumoId: ti.id,
            inventoryItemId: ti.inventoryItemId,
            variantId: ti.variantId ?? null,
            additionId: ti.additionId ?? null,
            size: ti.variesBySize ? size : null,
            qtyRequired: String(qtyRequired),
            qtyAvailable: String(qtyAvailable),
            qtyToPurchase: String(qtyToPurchase),
            unit: ti.unit,
            status: "PENDIENTE" as const,
            notes: ti.notes ?? null,
          });
        }
      }

      if (toInsert.length > 0) {
        await tx.insert(orderItemMoldingInsumos).values(toInsert);
      }
    });

    const inserted = await db
      .select()
      .from(orderItemMoldingInsumos)
      .where(eq(orderItemMoldingInsumos.orderItemMoldingId, moldingId));

    return Response.json({ items: inserted }, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("Could not calculate molding insumos", { status: 500 });
  }
}

/**
 * PATCH: Update the status of a specific insumo.
 * Used by: purchases (SOLICITADO_COMPRAS -> EN_STOCK),
 *          dispatch (EN_STOCK -> DESPACHADO_CONFECCION),
 *          confectionist return (DESPACHADO_CONFECCION -> COMPLETADO)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderItemId: string; moldingId: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-item-molding-insumos:patch",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MOLDERIA");
  if (forbidden) return forbidden;

  const { moldingId } = await params;

  let body: { insumoId?: string; status?: string; notes?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const validStatuses = [
    "PENDIENTE",
    "SOLICITADO_COMPRAS",
    "EN_STOCK",
    "DESPACHADO_CONFECCION",
    "COMPLETADO",
  ];

  if (!body.insumoId) {
    return new Response("insumoId is required", { status: 400 });
  }

  if (!body.status || !validStatuses.includes(body.status)) {
    return new Response(
      `status must be one of: ${validStatuses.join(", ")}`,
      { status: 400 },
    );
  }

  try {
    const [updated] = await db
      .update(orderItemMoldingInsumos)
      .set({
        status: body.status as
          | "PENDIENTE"
          | "SOLICITADO_COMPRAS"
          | "EN_STOCK"
          | "DESPACHADO_CONFECCION"
          | "COMPLETADO",
        notes: body.notes ? String(body.notes).trim() : undefined,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orderItemMoldingInsumos.id, body.insumoId),
          eq(orderItemMoldingInsumos.orderItemMoldingId, moldingId),
        ),
      )
      .returning();

    if (!updated) {
      return new Response("Insumo not found", { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("Could not update insumo status", { status: 500 });
  }
}
