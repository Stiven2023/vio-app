import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  purchaseOrderHistory,
  purchaseOrderItems,
  purchaseOrderReceiptLines,
  purchaseOrderReceipts,
  purchaseOrders,
  purchaseRequirementLines,
} from "@/src/db/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type ReceiptBody = {
  notes?: unknown;
  items?: Array<{
    purchaseOrderItemId?: unknown;
    receivedQty?: unknown;
    notes?: unknown;
  }>;
};

function str(value: unknown) {
  return String(value ?? "").trim();
}

function toPositive(value: unknown) {
  const num = Number(String(value ?? "").replace(/,/g, "."));

  if (!Number.isFinite(num) || num <= 0) return null;

  return num;
}

function toFixedAmount(value: number, digits = 2) {
  return value.toFixed(digits);
}

async function nextReceiptCode(tx: any) {
  const [row] = await tx
    .select({
      maxSuffix: sql<number>`max((substring(${purchaseOrderReceipts.receiptCode} from '(?i)^RC([0-9]+)$')::int))`,
    })
    .from(purchaseOrderReceipts)
    .where(sql`${purchaseOrderReceipts.receiptCode} ~* '^RC[0-9]+$'`)
    .limit(1);

  const next = (row?.maxSuffix ?? 10000) + 1;

  return `RC${String(next).padStart(5, "0")}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "purchase-orders:receipts:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const orderId = str(id);

    if (!orderId) return new Response("id required", { status: 400 });

    const receipts = await db
      .select({
        id: purchaseOrderReceipts.id,
        receiptCode: purchaseOrderReceipts.receiptCode,
        notes: purchaseOrderReceipts.notes,
        receivedAt: purchaseOrderReceipts.receivedAt,
        createdBy: purchaseOrderReceipts.createdBy,
        createdAt: purchaseOrderReceipts.createdAt,
      })
      .from(purchaseOrderReceipts)
      .where(eq(purchaseOrderReceipts.purchaseOrderId, orderId))
      .orderBy(sql`${purchaseOrderReceipts.createdAt} desc`);

    if (receipts.length === 0) {
      return Response.json({ items: [] });
    }

    const receiptIds = receipts.map((receipt) => receipt.id);

    const lines = await db
      .select({
        id: purchaseOrderReceiptLines.id,
        receiptId: purchaseOrderReceiptLines.receiptId,
        purchaseOrderItemId: purchaseOrderReceiptLines.purchaseOrderItemId,
        inventoryItemId: purchaseOrderReceiptLines.inventoryItemId,
        receivedQty: purchaseOrderReceiptLines.receivedQty,
        unitCost: purchaseOrderReceiptLines.unitCost,
        notes: purchaseOrderReceiptLines.notes,
      })
      .from(purchaseOrderReceiptLines)
      .where(inArray(purchaseOrderReceiptLines.receiptId, receiptIds));

    const linesByReceipt = new Map<string, typeof lines>();

    for (const line of lines) {
      const key = String(line.receiptId);
      const bucket = linesByReceipt.get(key) ?? [];

      bucket.push(line);
      linesByReceipt.set(key, bucket);
    }

    return Response.json({
      items: receipts.map((receipt) => ({
        ...receipt,
        lines: linesByReceipt.get(String(receipt.id)) ?? [],
      })),
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar recepciones", { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "purchase-orders:receipts:post",
    limit: 80,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_ENTRADA");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const orderId = str(id);

    if (!orderId) return new Response("id required", { status: 400 });

    const body = (await request.json().catch(() => ({}))) as ReceiptBody;
    const notes = str(body.notes) || null;
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (rawItems.length === 0) {
      return new Response("items required", { status: 400 });
    }

    const normalizedItems = rawItems
      .map((item) => {
        const purchaseOrderItemId = str(item.purchaseOrderItemId);
        const receivedQty = toPositive(item.receivedQty);
        const lineNotes = str(item.notes) || null;

        if (!purchaseOrderItemId || !receivedQty) return null;

        return {
          purchaseOrderItemId,
          receivedQty,
          notes: lineNotes,
        };
      })
      .filter(Boolean) as Array<{
      purchaseOrderItemId: string;
      receivedQty: number;
      notes: string | null;
    }>;

    if (normalizedItems.length !== rawItems.length) {
      return new Response("items invalid", { status: 400 });
    }

    const employeeId = getEmployeeIdFromRequest(request);

    const created = await db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          id: purchaseOrders.id,
          status: purchaseOrders.status,
          purchaseOrderCode: purchaseOrders.purchaseOrderCode,
        })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, orderId))
        .limit(1);

      if (!order) return { kind: "not-found" as const };

      if (order.status === "FINALIZADA" || order.status === "CANCELADA") {
        return { kind: "invalid-status" as const, status: order.status };
      }

      if (order.status !== "APROBADA" && order.status !== "EN_PROCESO") {
        return { kind: "invalid-status" as const, status: order.status };
      }

      const orderItemIds = normalizedItems.map((item) => item.purchaseOrderItemId);
      const poItems = await tx
        .select({
          id: purchaseOrderItems.id,
          purchaseOrderId: purchaseOrderItems.purchaseOrderId,
          purchaseRequirementLineId: purchaseOrderItems.purchaseRequirementLineId,
          inventoryItemId: purchaseOrderItems.inventoryItemId,
          quantity: purchaseOrderItems.quantity,
          unitPrice: purchaseOrderItems.unitPrice,
        })
        .from(purchaseOrderItems)
        .where(
          and(
            eq(purchaseOrderItems.purchaseOrderId, orderId),
            inArray(purchaseOrderItems.id, orderItemIds),
          ),
        );

      if (poItems.length !== orderItemIds.length) {
        return { kind: "items-invalid" as const };
      }

      const receivedRows = await tx
        .select({
          purchaseOrderItemId: purchaseOrderReceiptLines.purchaseOrderItemId,
          receivedTotal: sql<string>`coalesce(sum(${purchaseOrderReceiptLines.receivedQty}), 0)::text`,
        })
        .from(purchaseOrderReceiptLines)
        .leftJoin(
          purchaseOrderReceipts,
          eq(purchaseOrderReceiptLines.receiptId, purchaseOrderReceipts.id),
        )
        .where(eq(purchaseOrderReceipts.purchaseOrderId, orderId))
        .groupBy(purchaseOrderReceiptLines.purchaseOrderItemId);

      const alreadyReceived = new Map(
        receivedRows.map((row) => [
          String(row.purchaseOrderItemId),
          Number(row.receivedTotal ?? 0),
        ]),
      );

      for (const item of normalizedItems) {
        const poItem = poItems.find((entry) => entry.id === item.purchaseOrderItemId);

        if (!poItem) return { kind: "items-invalid" as const };

        const ordered = Number(poItem.quantity ?? 0);
        const current = alreadyReceived.get(String(poItem.id)) ?? 0;
        const pending = Math.max(0, ordered - current);

        if (item.receivedQty > pending) {
          return {
            kind: "qty-exceeded" as const,
            purchaseOrderItemId: poItem.id,
            pending,
          };
        }
      }

      const receiptCode = await nextReceiptCode(tx);

      const [receipt] = await tx
        .insert(purchaseOrderReceipts)
        .values({
          purchaseOrderId: orderId,
          receiptCode,
          notes,
          receivedAt: new Date(),
          createdBy: employeeId,
        })
        .returning({
          id: purchaseOrderReceipts.id,
          receiptCode: purchaseOrderReceipts.receiptCode,
        });

      const lines = normalizedItems.map((line) => {
        const poItem = poItems.find((entry) => entry.id === line.purchaseOrderItemId)!;

        return {
          receiptId: receipt.id,
          purchaseOrderItemId: poItem.id,
          inventoryItemId: poItem.inventoryItemId,
          receivedQty: toFixedAmount(line.receivedQty),
          unitCost: toFixedAmount(Number(poItem.unitPrice ?? 0)),
          notes: line.notes,
        };
      });

      await tx.insert(purchaseOrderReceiptLines).values(lines as any);

      const requirementReceivedDelta = new Map<string, number>();

      for (const line of lines) {
        const poItem = poItems.find(
          (entry) => String(entry.id) === String(line.purchaseOrderItemId),
        );
        const requirementLineId = String(poItem?.purchaseRequirementLineId ?? "").trim();

        if (!requirementLineId) continue;

        requirementReceivedDelta.set(
          requirementLineId,
          (requirementReceivedDelta.get(requirementLineId) ?? 0) +
            Number(line.receivedQty),
        );
      }

      const requirementLineIds = Array.from(requirementReceivedDelta.keys());

      if (requirementLineIds.length > 0) {
        const requirementRows = await tx
          .select({
            id: purchaseRequirementLines.id,
            qtyPlanned: purchaseRequirementLines.qtyPlanned,
            qtyReceived: purchaseRequirementLines.qtyReceived,
          })
          .from(purchaseRequirementLines)
          .where(inArray(purchaseRequirementLines.id, requirementLineIds));

        for (const row of requirementRows) {
          const currentReceived = Number(row.qtyReceived ?? 0);
          const planned = Number(row.qtyPlanned ?? 0);
          const delta = requirementReceivedDelta.get(String(row.id)) ?? 0;
          const nextReceived = Math.max(0, currentReceived + delta);
          const nextCoverage =
            planned > 0 && nextReceived >= planned ? "RECEIVED" : "PENDIENTE";

          await tx
            .update(purchaseRequirementLines)
            .set({
              qtyReceived: toFixedAmount(nextReceived),
              coverageStatus: nextCoverage,
              updatedAt: new Date(),
            })
            .where(eq(purchaseRequirementLines.id, row.id));
        }
      }

      const allReceivedRows = await tx
        .select({
          id: purchaseOrderItems.id,
          ordered: purchaseOrderItems.quantity,
          received: sql<string>`coalesce(sum(${purchaseOrderReceiptLines.receivedQty}), 0)::text`,
        })
        .from(purchaseOrderItems)
        .leftJoin(
          purchaseOrderReceiptLines,
          eq(purchaseOrderItems.id, purchaseOrderReceiptLines.purchaseOrderItemId),
        )
        .where(eq(purchaseOrderItems.purchaseOrderId, orderId))
        .groupBy(purchaseOrderItems.id, purchaseOrderItems.quantity);

      const fullyReceived = allReceivedRows.every((row) => {
        const ordered = Number(row.ordered ?? 0);
        const received = Number(row.received ?? 0);

        return received >= ordered;
      });

      await tx
        .update(purchaseOrders)
        .set({
          status: fullyReceived ? "FINALIZADA" : "EN_PROCESO",
          finalizedAt: fullyReceived ? new Date() : null,
        })
        .where(eq(purchaseOrders.id, orderId));

      await tx.insert(purchaseOrderHistory).values({
        purchaseOrderId: orderId,
        action: fullyReceived ? "RECEPCION_TOTAL" : "RECEPCION_PARCIAL",
        notes: `Recepcion ${receipt.receiptCode} registrada con ${lines.length} item(s).`,
        performedBy: employeeId,
      });

      return {
        kind: "ok" as const,
        receiptId: receipt.id,
        receiptCode: receipt.receiptCode,
        purchaseOrderCode: order.purchaseOrderCode,
        status: fullyReceived ? "FINALIZADA" : "EN_PROCESO",
        fullyReceived,
      };
    });

    if (created.kind === "not-found") {
      return new Response("Not found", { status: 404 });
    }

    if (created.kind === "invalid-status") {
      return new Response(
        `La orden no permite recepciones en estado ${created.status}`,
        {
          status: 422,
        },
      );
    }

    if (created.kind === "items-invalid") {
      return new Response("items invalid", { status: 400 });
    }

    if (created.kind === "qty-exceeded") {
      return new Response(
        `Cantidad recibida supera pendiente para item ${created.purchaseOrderItemId}. Pendiente: ${created.pending}`,
        { status: 422 },
      );
    }

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo registrar recepcion", { status: 500 });
  }
}
