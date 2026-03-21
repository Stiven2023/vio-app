import { eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  banks,
  inventoryItems,
  purchaseOrderHistory,
  purchaseOrderItems,
  purchaseOrders,
} from "@/src/db/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function toPositiveNumber(value: unknown) {
  const n = Number(String(value ?? "").replace(/,/g, "."));

  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatDecimal(value: number, fractionDigits = 2) {
  return value.toFixed(fractionDigits);
}

type UpdatePurchaseOrderBody = {
  supplierId?: string | null;
  bankId?: string | null;
  bankAccountRef?: string | null;
  notes?: string | null;
  items?: Array<{
    inventoryItemId: string;
    variantId?: string | null;
    quantity: unknown;
    unitPrice: unknown;
  }>;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "purchase-orders:edit:put",
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

    const body = (await request.json()) as UpdatePurchaseOrderBody;

    const supplierId = String(body?.supplierId ?? "").trim();
    const bankId = String(body?.bankId ?? "").trim();
    const bankAccountRef = String(body?.bankAccountRef ?? "").trim();
    const notes = String(body?.notes ?? "").trim();
    const rawItems = Array.isArray(body?.items) ? body.items : [];
    const employeeId = getEmployeeIdFromRequest(request);

    if (!bankId) return new Response("bankId required", { status: 400 });
    if (rawItems.length === 0)
      return new Response("items required", { status: 400 });

    if (supplierId) {
      const forbiddenSupplier = await requirePermission(
        request,
        "ASOCIAR_PROVEEDOR",
      );

      if (forbiddenSupplier) return forbiddenSupplier;
    }

    const normalizedItems = rawItems
      .map((it) => {
        const inventoryItemId = String(
          (it as any)?.inventoryItemId ?? "",
        ).trim();
        const variantId = String((it as any)?.variantId ?? "").trim() || null;
        const quantity = toPositiveNumber((it as any)?.quantity);
        const unitPrice = toPositiveNumber((it as any)?.unitPrice);

        return inventoryItemId && quantity && unitPrice
          ? {
              inventoryItemId,
              variantId,
              quantity: formatDecimal(quantity),
              unitPrice: formatDecimal(unitPrice),
            }
          : null;
      })
      .filter(Boolean) as Array<{
      inventoryItemId: string;
      variantId: string | null;
      quantity: string;
      unitPrice: string;
    }>;

    if (normalizedItems.length !== rawItems.length) {
      return new Response("items invalid", { status: 400 });
    }

    const [bankRow] = await db
      .select({
        id: banks.id,
        name: banks.name,
        accountRef: banks.accountRef,
        isActive: banks.isActive,
      })
      .from(banks)
      .where(eq(banks.id, bankId))
      .limit(1);

    if (!bankRow?.id || bankRow.isActive === false) {
      return new Response("bank invalid", { status: 400 });
    }

    const itemIds = Array.from(
      new Set(normalizedItems.map((item) => item.inventoryItemId)),
    );
    const itemRows = await db
      .select({
        id: inventoryItems.id,
        itemCode: inventoryItems.itemCode,
        name: inventoryItems.name,
        unit: inventoryItems.unit,
      })
      .from(inventoryItems)
      .where(inArray(inventoryItems.id, itemIds));

    const itemMap = new Map(itemRows.map((row) => [row.id, row]));

    if (itemMap.size !== itemIds.length) {
      return new Response("items invalid", { status: 400 });
    }

    const orderItems = normalizedItems.map((item) => {
      const source = itemMap.get(item.inventoryItemId);

      if (!source) {
        throw new Error("items invalid");
      }

      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const lineTotal = quantity * unitPrice;

      return {
        inventoryItemId: item.inventoryItemId,
        variantId: item.variantId ?? null,
        itemCode: source.itemCode,
        itemName: source.name,
        unit: source.unit,
        quantity: formatDecimal(quantity),
        unitPrice: formatDecimal(unitPrice),
        lineTotal: formatDecimal(lineTotal),
      };
    });

    const subtotal = orderItems.reduce(
      (acc, item) => acc + Number(item.lineTotal),
      0,
    );
    const subtotalValue = formatDecimal(subtotal);

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: purchaseOrders.id, status: purchaseOrders.status })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, orderId))
        .limit(1);

      if (!current) {
        return null;
      }

      if (current.status !== "PENDIENTE" && current.status !== "RECHAZADA") {
        throw new Error("solo pendiente o rechazada puede editarse");
      }

      const [order] = await tx
        .update(purchaseOrders)
        .set({
          supplierId: supplierId || null,
          notes: notes || null,
          bankId: bankRow.id,
          bankName: bankRow.name,
          bankAccountRef: bankAccountRef || bankRow.accountRef,
          subtotal: subtotalValue,
          total: subtotalValue,
          rejectedAt: null,
          rejectedBy: null,
          rejectionReason: null,
        })
        .where(eq(purchaseOrders.id, orderId))
        .returning({ id: purchaseOrders.id, status: purchaseOrders.status });

      await tx
        .delete(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

      await tx.insert(purchaseOrderItems).values(
        orderItems.map((it) => ({
          purchaseOrderId: orderId,
          inventoryItemId: it.inventoryItemId,
          variantId: it.variantId,
          itemCode: it.itemCode,
          itemName: it.itemName,
          unit: it.unit,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: it.lineTotal,
        })),
      );

      await tx.insert(purchaseOrderHistory).values({
        purchaseOrderId: orderId,
        action: "ORDEN_EDITADA",
        notes: "Actualización de cabecera e ítems desde editor",
        performedBy: employeeId,
      });

      return order;
    });

    if (!updated?.id) return new Response("Not found", { status: 404 });

    return Response.json(updated);
  } catch (error) {
    const message = String((error as { message?: string })?.message ?? "");

    if (message === "solo pendiente o rechazada puede editarse") {
      return new Response(message, { status: 409 });
    }

    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo editar la orden de compra", {
      status: 500,
    });
  }
}
