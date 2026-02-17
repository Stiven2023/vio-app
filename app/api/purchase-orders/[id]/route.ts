import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryEntries,
  inventoryItems,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { syncInventoryForItem } from "@/src/utils/inventory-sync";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "purchase-orders:get-one",
    limit: 300,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const orderId = String(id ?? "").trim();
    if (!orderId) return new Response("id required", { status: 400 });

    const [order] = await db
      .select({
        id: purchaseOrders.id,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        status: purchaseOrders.status,
        notes: purchaseOrders.notes,
        createdAt: purchaseOrders.createdAt,
        finalizedAt: purchaseOrders.finalizedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.id, orderId))
      .limit(1);

    if (!order) return new Response("Not found", { status: 404 });

    const items = await db
      .select({
        id: purchaseOrderItems.id,
        inventoryItemId: purchaseOrderItems.inventoryItemId,
        itemName: inventoryItems.name,
        unit: inventoryItems.unit,
        quantity: purchaseOrderItems.quantity,
      })
      .from(purchaseOrderItems)
      .leftJoin(
        inventoryItems,
        eq(purchaseOrderItems.inventoryItemId, inventoryItems.id),
      )
      .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

    return Response.json({ ...order, items });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar la orden", { status: 500 });
  }
}

type UpdateBody = { action?: string };

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "purchase-orders:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const orderId = String(id ?? "").trim();
    if (!orderId) return new Response("id required", { status: 400 });

    const body = (await request.json()) as UpdateBody;
    const action = String(body?.action ?? "").trim().toUpperCase();

    if (action !== "FINALIZAR") {
      return new Response("action inválida", { status: 400 });
    }

    const forbiddenEntry = await requirePermission(request, "REGISTRAR_ENTRADA");
    if (forbiddenEntry) return forbiddenEntry;

    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          id: purchaseOrders.id,
          status: purchaseOrders.status,
          supplierId: purchaseOrders.supplierId,
        })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, orderId))
        .limit(1);

      if (!order) return { kind: "not-found" as const };

      if (order.status === "FINALIZADA") {
        return { kind: "already" as const };
      }

      if (order.status !== "PENDIENTE") {
        return { kind: "invalid-status" as const, status: order.status };
      }

      const items = await tx
        .select({
          inventoryItemId: purchaseOrderItems.inventoryItemId,
          quantity: purchaseOrderItems.quantity,
        })
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

      if (items.length === 0) {
        return { kind: "no-items" as const };
      }

      await tx.insert(inventoryEntries).values(
        items.map((it) => ({
          inventoryItemId: it.inventoryItemId,
          supplierId: order.supplierId,
          quantity: it.quantity,
        })),
      );

      const uniqueItemIds = Array.from(
        new Set(items.map((it) => it.inventoryItemId).filter(Boolean)),
      );

      for (const itemId of uniqueItemIds) {
        await syncInventoryForItem(tx, itemId);
      }

      const [updated] = await tx
        .update(purchaseOrders)
        .set({ status: "FINALIZADA", finalizedAt: new Date() })
        .where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.status, "PENDIENTE")))
        .returning({
          id: purchaseOrders.id,
          status: purchaseOrders.status,
          finalizedAt: purchaseOrders.finalizedAt,
        });

      return { kind: "ok" as const, updated };
    });

    if (result.kind === "not-found") return new Response("Not found", { status: 404 });
    if (result.kind === "already") return new Response("Ya finalizada", { status: 409 });
    if (result.kind === "no-items") return new Response("Sin items", { status: 409 });
    if (result.kind === "invalid-status") return new Response("Estado inválido", { status: 409 });

    return Response.json(result.updated);
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo finalizar la orden", { status: 500 });
  }
}
