import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { purchaseOrderItems, purchaseOrders, suppliers } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "purchase-orders:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(purchaseOrders);

    const items = await db
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
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar órdenes de compra", { status: 500 });
  }
}

type CreatePurchaseOrderBody = {
  supplierId?: string | null;
  notes?: string | null;
  items?: Array<{ inventoryItemId: string; quantity: unknown }>;
};

function toPositiveNumber(v: unknown) {
  const n = Number(String(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "purchase-orders:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");
  if (forbidden) return forbidden;

  try {
    const body = (await request.json()) as CreatePurchaseOrderBody;

    const supplierId = String(body?.supplierId ?? "").trim();
    const notes = String(body?.notes ?? "").trim();
    const rawItems = Array.isArray(body?.items) ? body.items : [];

    if (supplierId) {
      const forbiddenSupplier = await requirePermission(request, "ASOCIAR_PROVEEDOR");
      if (forbiddenSupplier) return forbiddenSupplier;
    }

    if (rawItems.length === 0) {
      return new Response("items required", { status: 400 });
    }

    const normalizedItems = rawItems
      .map((it) => {
        const inventoryItemId = String((it as any)?.inventoryItemId ?? "").trim();
        const quantity = toPositiveNumber((it as any)?.quantity);

        return inventoryItemId && quantity
          ? { inventoryItemId, quantity: String(quantity) }
          : null;
      })
      .filter(Boolean) as Array<{ inventoryItemId: string; quantity: string }>;

    if (normalizedItems.length !== rawItems.length) {
      return new Response("items invalid", { status: 400 });
    }

    const created = await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(purchaseOrders)
        .values({
          supplierId: supplierId ? supplierId : null,
          status: "PENDIENTE",
          notes: notes ? notes : null,
        })
        .returning();

      await tx.insert(purchaseOrderItems).values(
        normalizedItems.map((it) => ({
          purchaseOrderId: order.id,
          inventoryItemId: it.inventoryItemId,
          quantity: it.quantity,
        })),
      );

      return order;
    });

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo crear la orden de compra", { status: 500 });
  }
}
