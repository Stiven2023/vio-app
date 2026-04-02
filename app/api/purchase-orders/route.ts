import { desc, eq, ilike, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  banks,
  inventoryItems,
  purchaseOrderHistory,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
} from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function formatDecimal(value: number, fractionDigits = 2) {
  return value.toFixed(fractionDigits);
}

function toPositiveNumber(value: unknown) {
  const n = Number(String(value ?? "").replace(/,/g, "."));

  return Number.isFinite(n) && n > 0 ? n : null;
}

async function generatePurchaseOrderCode(tx: any) {
  const [row] = await tx
    .select({
      maxSuffix: sql<number>`max((substring(${purchaseOrders.purchaseOrderCode} from '(?i)^OC([0-9]+)$')::int))`,
    })
    .from(purchaseOrders)
    .where(ilike(purchaseOrders.purchaseOrderCode, "OC%"))
    .limit(1);

  const next = (row?.maxSuffix ?? 10000) + 1;

  return `OC${String(next).padStart(5, "0")}`;
}

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
        purchaseOrderCode: purchaseOrders.purchaseOrderCode,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        status: purchaseOrders.status,
        notes: purchaseOrders.notes,
        bankId: purchaseOrders.bankId,
        bankName: purchaseOrders.bankName,
        bankAccountRef: purchaseOrders.bankAccountRef,
        approvedAt: purchaseOrders.approvedAt,
        approvalExpiresAt: purchaseOrders.approvalExpiresAt,
        rejectedAt: purchaseOrders.rejectedAt,
        rejectionReason: purchaseOrders.rejectionReason,
        subtotal: purchaseOrders.subtotal,
        total: purchaseOrders.total,
        createdAt: purchaseOrders.createdAt,
        finalizedAt: purchaseOrders.finalizedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(banks, eq(purchaseOrders.bankId, banks.id))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo consultar órdenes de compra", {
      status: 500,
    });
  }
}

type CreatePurchaseOrderBody = {
  supplierId?: string | null;
  bankId?: string | null;
  bankAccountRef?: string | null;
  notes?: string | null;
  items?: Array<{
    inventoryItemId: string;
    purchaseRequirementLineId?: string | null;
    variantId?: string | null;
    quantity: unknown;
    unitPrice: unknown;
  }>;
};

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
    const employeeId = getEmployeeIdFromRequest(request);

    const supplierId = String(body?.supplierId ?? "").trim();
    const bankId = String(body?.bankId ?? "").trim();
    const bankAccountRef = String(body?.bankAccountRef ?? "").trim();
    const notes = String(body?.notes ?? "").trim();
    const rawItems = Array.isArray(body?.items) ? body.items : [];

    if (!bankId) {
      return new Response("bankId required", { status: 400 });
    }

    if (!bankAccountRef) {
      return new Response("bankAccountRef required", { status: 400 });
    }

    if (supplierId) {
      const forbiddenSupplier = await requirePermission(
        request,
        "ASOCIAR_PROVEEDOR",
      );

      if (forbiddenSupplier) return forbiddenSupplier;
    }

    if (rawItems.length === 0) {
      return new Response("items required", { status: 400 });
    }

    const normalizedItems = rawItems
      .map((it) => {
        const inventoryItemId = String(
          (it as any)?.inventoryItemId ?? "",
        ).trim();
        const purchaseRequirementLineId =
          String((it as any)?.purchaseRequirementLineId ?? "").trim() || null;
        const variantId = String((it as any)?.variantId ?? "").trim() || null;
        const quantity = toPositiveNumber((it as any)?.quantity);
        const unitPrice = toPositiveNumber((it as any)?.unitPrice);

        return inventoryItemId && quantity && unitPrice
          ? {
              inventoryItemId,
              purchaseRequirementLineId,
              variantId,
              quantity: formatDecimal(quantity),
              unitPrice: formatDecimal(unitPrice),
            }
          : null;
      })
      .filter(Boolean) as Array<{
      inventoryItemId: string;
      purchaseRequirementLineId: string | null;
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
        purchaseRequirementLineId: item.purchaseRequirementLineId,
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

    const created = await db.transaction(async (tx) => {
      const purchaseOrderCode = await generatePurchaseOrderCode(tx);

      const [order] = await tx
        .insert(purchaseOrders)
        .values({
          purchaseOrderCode,
          supplierId: supplierId ? supplierId : null,
          createdBy: employeeId,
          status: "PENDIENTE",
          notes: notes ? notes : null,
          bankId: bankRow.id,
          bankName: bankRow.name,
          bankAccountRef: bankAccountRef || bankRow.accountRef,
          subtotal: subtotalValue,
          total: subtotalValue,
        })
        .returning();

      await tx.insert(purchaseOrderItems).values(
        orderItems.map((it) => ({
          purchaseOrderId: order.id,
          inventoryItemId: it.inventoryItemId,
          purchaseRequirementLineId: it.purchaseRequirementLineId,
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
        purchaseOrderId: order.id,
        action: "ORDEN_CREADA",
        notes: notes
          ? `Orden creada. ${notes}`
          : "Orden creada en estado PENDIENTE",
        performedBy: employeeId,
      });

      return order;
    });

    void createNotificationsForPermission("CREAR_ORDEN_COMPRA", {
      title: "Orden de compra creada",
      message: `Se creó la orden de compra ${created.purchaseOrderCode}.`,
      href: `/erp/compras/${created.id}`,
    });

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear la orden de compra", { status: 500 });
  }
}