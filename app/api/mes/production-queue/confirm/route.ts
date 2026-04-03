import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { erpDb, mesDb } from "@/src/db";
import { mesProductionQueue } from "@/src/db/mes/schema";
import { orders, preInvoices } from "@/src/db/erp/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import { dbJsonError, jsonError, jsonForbidden } from "@/src/utils/api-error";
import { findBlockedOrdersForQueueConfirmation } from "@/src/utils/mes-workflow";
import { rateLimit } from "@/src/utils/rate-limit";

function canWrite(role: string | null) {
  return role === "ADMINISTRADOR" || role === "LIDER_OPERACIONAL";
}

/**
 * POST /api/mes/production-queue/confirm
 * The production leader confirms the queue, setting confirmedAt on all EN_COLA items.
 * This "activates" the queue so that the Montaje process can start picking tickets.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:production-queue:confirm",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);

  if (!role || !canWrite(role)) {
    return jsonForbidden();
  }

  const employeeId = getEmployeeIdFromRequest(request);

  try {
    const queueRows = await mesDb
      .select({
        id: mesProductionQueue.id,
        orderId: mesProductionQueue.orderId,
        confirmedAt: mesProductionQueue.confirmedAt,
      })
      .from(mesProductionQueue)
      .where(eq(mesProductionQueue.status, "EN_COLA"));

    if (queueRows.length === 0) {
      return jsonError(
        409,
        "QUEUE_EMPTY",
        "No hay pedidos en cola para confirmar.",
      );
    }

    if (queueRows.every((row) => row.confirmedAt !== null)) {
      return jsonError(
        409,
        "QUEUE_ALREADY_CONFIRMED",
        "La cola ya fue confirmada previamente.",
      );
    }

    const orderIds = Array.from(
      new Set(queueRows.map((row) => String(row.orderId ?? "").trim()).filter(Boolean)),
    );
    const accountingRows = orderIds.length
      ? await erpDb
          .select({
            orderCode: orders.orderCode,
            accountingStatus: preInvoices.status,
            advanceReceived: preInvoices.advanceReceived,
            advanceStatus: preInvoices.advanceStatus,
          })
          .from(orders)
          .leftJoin(preInvoices, eq(preInvoices.orderId, orders.id))
          .where(inArray(orders.id, orderIds))
      : [];

    const blockedOrders = findBlockedOrdersForQueueConfirmation(
      accountingRows.map((row) => ({
        orderCode: String(row.orderCode ?? "").trim(),
        accountingStatus: row.accountingStatus,
        advanceReceived: row.advanceReceived,
        advanceStatus: row.advanceStatus,
      })),
    );

    if (blockedOrders.length > 0) {
      return jsonError(
        422,
        "ACCOUNTING_APPROVAL_REQUIRED",
        "Hay pedidos en la cola que aún no tienen OK de contabilidad.",
        {
          orderCodes: blockedOrders.map(
            (orderCode) => `${orderCode}: pendiente validación contable`,
          ),
        },
      );
    }

    const now = new Date();

    const updated = await mesDb
      .update(mesProductionQueue)
      .set({
        confirmedAt: now,
        confirmedBy: employeeId,
        updatedAt: now,
      })
      .where(
        and(
          eq(mesProductionQueue.status, "EN_COLA"),
          isNull(mesProductionQueue.confirmedAt),
        ),
      )
      .returning({ id: mesProductionQueue.id });

    if (updated.length === 0) {
      return jsonError(
        409,
        "QUEUE_ALREADY_CONFIRMED",
        "La cola ya fue confirmada previamente.",
      );
    }

    return Response.json({
      confirmed: updated.length,
      confirmedAt: now.toISOString(),
    });
  } catch (error) {
    const resp = dbJsonError(
      error,
      "No se pudo confirmar la cola de producción.",
    );

    if (resp) return resp;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo confirmar la cola de producción.",
    );
  }
}
