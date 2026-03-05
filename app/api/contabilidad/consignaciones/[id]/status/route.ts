import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { orderPayments, orders, orderStatusHistory, prefacturas, shipments } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { isConfirmedPaymentStatus } from "@/src/utils/payment-status";
import { rateLimit } from "@/src/utils/rate-limit";

function normalizeStatus(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "PAGADO" || raw === "CONSIGNADO") return "PAGADO" as const;
  if (raw === "ANULADO" || raw === "NO_CONSIGNADO" || raw === "DESECHADO") {
    return "ANULADO" as const;
  }
  return null;
}

async function syncOrderStatusByPayments(orderId: string, orderCode: string | null) {
  const [orderRow] = await db
    .select({ id: orders.id, total: orders.total, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return;

  const paidRows = await db
    .select({
      amount: orderPayments.amount,
      status: orderPayments.status,
    })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId));

  const total = Math.max(0, Number(orderRow.total ?? 0));
  const paidTotal = Math.max(
    0,
    paidRows.reduce((acc, row) => {
      if (!isConfirmedPaymentStatus(row.status)) return acc;
      const amount = Number(row.amount ?? 0);
      return acc + (Number.isFinite(amount) ? amount : 0);
    }, 0),
  );
  const paidPercent = total > 0 ? (paidTotal / total) * 100 : 0;

  const nextStatus =
    paidPercent >= 50
      ? "PRODUCCION"
      : paidTotal > 0
        ? "APROBACION_INICIAL"
        : "PENDIENTE";

  const nextPrefacturaStatus =
    paidPercent >= 50
      ? "PROGRAMACION"
      : paidTotal > 0
        ? "APROBACION_INICIAL"
        : "PENDIENTE_CONTABILIDAD";

  await db.transaction(async (tx) => {
    const [currentOrder] = await tx
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (String(currentOrder?.status ?? "") !== nextStatus) {
      await tx
        .update(orders)
        .set({ status: nextStatus as any })
        .where(eq(orders.id, orderId));

      await tx.insert(orderStatusHistory).values({
        orderId,
        status: nextStatus as any,
        changedBy: null,
      });
    }

    await tx
      .update(prefacturas)
      .set({ status: nextPrefacturaStatus })
      .where(eq(prefacturas.orderId, orderId));

    if (orderCode) {
      await tx
        .update(shipments)
        .set({
          paymentStatus: paidPercent >= 50 ? "PAGADO" : "PENDIENTE",
          updatedAt: new Date(),
        })
        .where(and(eq(shipments.orderCode, orderCode), eq(shipments.mode, "CLIENT")));
    }
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "contabilidad:consignaciones:status:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "APROBAR_PAGO");
  if (forbidden) return forbidden;

  const { id } = await params;
  const paymentId = String(id ?? "").trim();
  if (!paymentId) return new Response("id requerido", { status: 400 });

  try {
    const body = (await request.json()) as { status?: unknown };
    const status = normalizeStatus(body.status);

    if (!status) {
      return new Response("status inválido. Usa PAGADO/CONSIGNADO o ANULADO/DESECHADO", {
        status: 400,
      });
    }

    const [updated] = await db
      .update(orderPayments)
      .set({ status: status as any })
      .where(eq(orderPayments.id, paymentId))
      .returning({
        id: orderPayments.id,
        status: orderPayments.status,
        orderId: orderPayments.orderId,
      });

    if (!updated) return new Response("Consignación no encontrada", { status: 404 });

    if (updated.orderId) {
      const [orderRow] = await db
        .select({ orderCode: orders.orderCode })
        .from(orders)
        .where(eq(orders.id, String(updated.orderId)))
        .limit(1);

      await syncOrderStatusByPayments(String(updated.orderId), orderRow?.orderCode ?? null);
    }

    return Response.json({ ok: true, id: updated.id, status: updated.status });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo actualizar el estado de la consignación", { status: 500 });
  }
}
