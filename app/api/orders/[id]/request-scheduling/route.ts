import { and, desc, eq, sql } from "drizzle-orm";

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

function isFinalOrLockedStatus(status: string) {
  return [
    "PROGRAMACION",
    "PRODUCCION",
    "ATRASADO",
    "FINALIZADO",
    "ENTREGADO",
    "CANCELADO",
  ].includes(status);
}

function resolveAccountingStatus(args: {
  prefacturaStatus: unknown;
  advanceStatus: unknown;
}) {
  const prefacturaStatus = normalizeStatus(args.prefacturaStatus);
  const advanceStatus = normalizeStatus(args.advanceStatus);

  if (prefacturaStatus === "APROBADO_CONTABILIDAD") {
    return "APROBADO_CONTABILIDAD" as const;
  }

  if (advanceStatus === "RECIBIDO") {
    return "APROBADO_CONTABILIDAD" as const;
  }

  return "PENDIENTE_CONTABILIDAD" as const;
}

function calculatePercent(paidTotal: number, denominator: number) {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  if (!Number.isFinite(paidTotal) || paidTotal <= 0) return 0;

  return Math.max(0, (paidTotal / denominator) * 100);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "orders:request-scheduling",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CAMBIAR_ESTADO_PEDIDO");

  if (forbidden) return forbidden;

  const role = getRoleFromRequest(request);
  const employeeId = getEmployeeIdFromRequest(request);

  if (role === "ASESOR" && !employeeId) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const orderId = String(id ?? "").trim();

  if (!orderId) return new Response("id required", { status: 400 });

  const [orderRow] = await db
    .select({
      id: orders.id,
      status: orders.status,
      total: orders.total,
      shippingFee: (orders as any).shippingFee,
      createdBy: orders.createdBy,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return new Response("Not found", { status: 404 });

  if (role === "ASESOR" && orderRow.createdBy !== employeeId) {
    return new Response("Forbidden", { status: 403 });
  }

  const currentStatus = normalizeStatus(orderRow.status);

  if (isFinalOrLockedStatus(currentStatus)) {
    return Response.json({
      ok: false,
      changed: false,
      fromStatus: currentStatus,
      toStatus: null,
      reason: `The order is already in ${currentStatus} and cannot be dispatched manually.`,
    });
  }

  const [prefacturaRow] = await db
    .select({
      id: prefacturas.id,
      status: prefacturas.status,
      total: prefacturas.total,
      totalAfterWithholdings: prefacturas.totalAfterWithholdings,
      advanceRequired: prefacturas.advanceRequired,
      advanceReceived: prefacturas.advanceReceived,
      advanceStatus: prefacturas.advanceStatus,
    })
    .from(prefacturas)
    .where(eq(prefacturas.orderId, orderId))
    .orderBy(desc(prefacturas.createdAt))
    .limit(1);

  const paymentRows = await db
    .select({ amount: orderPayments.amount, status: orderPayments.status })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId));

  const confirmedPaidTotal = paymentRows.reduce((acc, row) => {
    if (!isConfirmedPaymentStatus(row.status)) return acc;

    return acc + toNumber(row.amount);
  }, 0);

  const prefacturaTotal = prefacturaRow
    ? toNumber(prefacturaRow.totalAfterWithholdings ?? prefacturaRow.total)
    : 0;
  const orderGrossTotal =
    Math.max(0, toNumber(orderRow.total)) +
    Math.max(0, toNumber(orderRow.shippingFee));
  const denominator = prefacturaTotal > 0 ? prefacturaTotal : orderGrossTotal;
  const paidPercent = calculatePercent(confirmedPaidTotal, denominator);

  const advanceRequired = Math.max(0, toNumber(prefacturaRow?.advanceRequired));
  const requiresAdvance = advanceRequired > 0;
  const accountingStatus = resolveAccountingStatus({
    prefacturaStatus: prefacturaRow?.status,
    advanceStatus: prefacturaRow?.advanceStatus,
  });

  let targetStatus: "APROBACION" | "PROGRAMACION" | null = null;
  let reason = "";

  if (accountingStatus === "PENDIENTE_CONTABILIDAD") {
    targetStatus = "APROBACION";
    reason =
      "Accounting has not approved the advance yet; order is sent to Approval and cannot move to Scheduling.";
  } else if (!requiresAdvance) {
    targetStatus = "APROBACION";
    reason =
      "This prefactura does not require advance payment; order remains in Approval before Scheduling.";
  } else if (paidPercent >= 50) {
    targetStatus = "PROGRAMACION";
    reason =
      currentStatus === "APROBACION"
        ? "Accounting approved the advance and payment is at least 50%; order auto-advances from Approval to Scheduling (Option B)."
        : "Accounting approved the advance and payment is at least 50%; order is sent to Scheduling.";
  } else {
    targetStatus = "APROBACION";
    reason =
      "Accounting approved the advance, but confirmed payment is below 50%; order is sent to Approval.";
  }

  if (!targetStatus) {
    return Response.json({
      ok: false,
      changed: false,
      fromStatus: currentStatus,
      toStatus: null,
      reason,
      paidPercent,
      accountingStatus,
      requiresAdvance,
      prefacturaId: prefacturaRow?.id ?? null,
    });
  }

  if (targetStatus === currentStatus) {
    return Response.json({
      ok: true,
      changed: false,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      reason,
      paidPercent,
      accountingStatus,
      requiresAdvance,
      prefacturaId: prefacturaRow?.id ?? null,
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: targetStatus as any })
      .where(eq(orders.id, orderId));

    if (targetStatus === "PROGRAMACION") {
      await ensurePurchaseRequirementsForOrder({
        dbOrTx: tx,
        orderId,
        createdBy: employeeId,
      });
    }

    await tx.insert(orderStatusHistory).values({
      orderId,
      status: targetStatus as any,
      changedBy: employeeId,
      reasonCode:
        targetStatus === "PROGRAMACION"
          ? "ADVISOR_REQUEST_SCHEDULING"
          : "ADVISOR_REQUEST_APPROVAL",
      meta: {
        fromStatus: currentStatus,
        toStatus: targetStatus,
        paidPercent,
        accountingStatus,
        requiresAdvance,
        prefacturaId: prefacturaRow?.id ?? null,
      },
    });

    // Keep the latest prefactura status in sync with accounting approval naming.
    if (prefacturaRow?.id && accountingStatus === "APROBADO_CONTABILIDAD") {
      await tx
        .update(prefacturas)
        .set({ status: "APROBADO_CONTABILIDAD" as any })
        .where(
          and(
            eq(prefacturas.id, prefacturaRow.id),
            sql`${prefacturas.status} <> 'APROBADO_CONTABILIDAD'`,
          ),
        );
    }
  });

  return Response.json({
    ok: true,
    changed: true,
    fromStatus: currentStatus,
    toStatus: targetStatus,
    reason,
    paidPercent,
    accountingStatus,
    requiresAdvance,
    prefacturaId: prefacturaRow?.id ?? null,
  });
}
