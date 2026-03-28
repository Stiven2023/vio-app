import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  orderPayments,
  orders,
  orderStatusHistory,
  prefacturas,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import { isConfirmedPaymentStatus } from "@/src/utils/payment-status";
import { requirePermission } from "@/src/utils/permission-middleware";
import { ensurePurchaseRequirementsForOrder } from "@/src/utils/purchase-requirements";
import { rateLimit } from "@/src/utils/rate-limit";

function toNumber(value: unknown) {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
}

function normalizeStatus(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function calculatePercent(paidTotal: number, denominator: number) {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  if (!Number.isFinite(paidTotal) || paidTotal <= 0) return 0;

  return Math.max(0, (paidTotal / denominator) * 100);
}

function isOrderLockedForProgress(status: string) {
  return [
    "PRODUCCION",
    "ATRASADO",
    "FINALIZADO",
    "ENTREGADO",
    "CANCELADO",
  ].includes(status);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "prefacturas:approve-advance",
    limit: 80,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "APROBAR_PAGO");

  if (forbidden) return forbidden;

  const role = getRoleFromRequest(request);
  const employeeId = getEmployeeIdFromRequest(request);

  if (role === "ASESOR" && !employeeId) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    note?: unknown;
    reference?: unknown;
  };

  const note = String(body.note ?? "").trim();
  const reference = String(body.reference ?? "").trim();

  const { id } = await params;
  const prefacturaId = String(id ?? "").trim();

  if (!prefacturaId) return new Response("id required", { status: 400 });

  const current = await db
    .select({
      prefacturaId: prefacturas.id,
      prefacturaStatus: prefacturas.status,
      orderId: prefacturas.orderId,
      prefacturaTotal: prefacturas.total,
      prefacturaNetTotal: prefacturas.totalAfterWithholdings,
      advanceRequired: prefacturas.advanceRequired,
      advanceReceived: prefacturas.advanceReceived,
      advanceStatus: prefacturas.advanceStatus,
      orderStatus: orders.status,
      orderTotal: orders.total,
      orderShippingFee: (orders as any).shippingFee,
      orderCreatedBy: orders.createdBy,
    })
    .from(prefacturas)
    .leftJoin(orders, eq(prefacturas.orderId, orders.id))
    .where(eq(prefacturas.id, prefacturaId))
    .limit(1);

  const row = current[0];

  if (!row) return new Response("Prefactura no encontrada", { status: 404 });

  if (!row.orderId) {
    return new Response("La prefactura no tiene pedido asociado", {
      status: 422,
    });
  }

  if (role === "ASESOR" && row.orderCreatedBy !== employeeId) {
    return new Response("Forbidden", { status: 403 });
  }

  const orderStatus = normalizeStatus(row.orderStatus);

  if (orderStatus === "PENDIENTE") {
    return new Response(
      "No se puede aprobar anticipo mientras el pedido siga en PENDIENTE. Envíalo primero a APROBACION o PENDIENTE_CONTABILIDAD.",
      { status: 422 },
    );
  }

  if (isOrderLockedForProgress(orderStatus)) {
    return new Response(
      "No se puede aprobar anticipo: el pedido está en un estado bloqueado para este flujo.",
      { status: 422 },
    );
  }

  const payments = await db
    .select({ amount: orderPayments.amount, status: orderPayments.status })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, String(row.orderId)));

  const confirmedPaidTotal = payments.reduce((acc, payment) => {
    if (!isConfirmedPaymentStatus(payment.status)) return acc;

    return acc + toNumber(payment.amount);
  }, 0);

  const prefacturaNetTotal = toNumber(
    row.prefacturaNetTotal ?? row.prefacturaTotal,
  );
  const orderGrossTotal =
    Math.max(0, toNumber(row.orderTotal)) +
    Math.max(0, toNumber(row.orderShippingFee));
  const denominator =
    prefacturaNetTotal > 0 ? prefacturaNetTotal : orderGrossTotal;
  const paidPercent = calculatePercent(confirmedPaidTotal, denominator);

  const advanceRequired = Math.max(0, toNumber(row.advanceRequired));
  const advanceReceived = Math.max(0, toNumber(row.advanceReceived));
  const requiresAdvance = advanceRequired > 0;

  if (requiresAdvance && Math.max(advanceReceived, confirmedPaidTotal) <= 0) {
    return new Response(
      "No hay anticipo registrado para aprobar. Registra o confirma un pago primero.",
      { status: 422 },
    );
  }

  let nextOrderStatus: string | null = null;
  let orderReasonCode = "ACCOUNTING_APPROVED_ADVANCE";

  if (orderStatus === "PENDIENTE_CONTABILIDAD" || orderStatus === "PENDIENTE") {
    nextOrderStatus = "APROBADO_CONTABILIDAD";
  }

  let autoScheduled = false;

  if (orderStatus === "APROBACION" && requiresAdvance && paidPercent >= 50) {
    nextOrderStatus = "PROGRAMACION";
    orderReasonCode = "AUTO_SCHEDULE_AFTER_ACCOUNTING";
    autoScheduled = true;
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(prefacturas)
      .set({
        status: "APROBADO_CONTABILIDAD" as any,
        advanceStatus: "RECIBIDO" as any,
        approvedAt: now,
      })
      .where(eq(prefacturas.id, prefacturaId));

    if (nextOrderStatus) {
      await tx
        .update(orders)
        .set({ status: nextOrderStatus as any })
        .where(eq(orders.id, String(row.orderId)));

      if (nextOrderStatus === "PROGRAMACION") {
        await ensurePurchaseRequirementsForOrder({
          dbOrTx: tx,
          orderId: String(row.orderId),
          createdBy: employeeId,
        });
      }

      await tx.insert(orderStatusHistory).values({
        orderId: String(row.orderId),
        status: nextOrderStatus as any,
        changedBy: employeeId,
        reasonCode: orderReasonCode,
        meta: {
          prefacturaId,
          prefacturaStatusBefore: row.prefacturaStatus,
          orderStatusBefore: row.orderStatus,
          paidPercent,
          confirmedPaidTotal,
          prefacturaNetTotal: denominator,
          advanceRequired,
          advanceReceived,
          requiresAdvance,
          note: note || null,
          reference: reference || null,
        },
      });
    }
  });

  return Response.json({
    ok: true,
    prefacturaId,
    orderId: row.orderId,
    accountingApproved: true,
    fromOrderStatus: orderStatus,
    toOrderStatus: nextOrderStatus,
    paidPercent,
    autoScheduled,
    message: autoScheduled
      ? "Anticipo aprobado y pedido movido automáticamente a PROGRAMACION."
      : "Anticipo aprobado en contabilidad.",
  });
}
