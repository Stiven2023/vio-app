import { eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import { orderPayments, orders, orderStatusHistory, prefacturas } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import {
  resolvePaymentBankById,
  validatePaymentBankCurrency,
} from "@/src/utils/payment-banks";
import { isConfirmedPaymentStatus } from "@/src/utils/payment-status";
import { rateLimit } from "@/src/utils/rate-limit";

function toNullableNumericString(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));

  if (Number.isNaN(n)) return null;

  return String(n);
}

function toPositiveNumericString(v: unknown) {
  const raw = toNullableNumericString(v);
  const n = raw ? Number(raw) : 0;

  if (!Number.isFinite(n) || n <= 0) return null;

  return String(n);
}

const methods = new Set(["EFECTIVO", "TRANSFERENCIA", "CREDITO"]);
async function syncOrderStatusByPayments(orderId: string) {
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
  });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "payments:distributed:post",
    limit: 100,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PAGO");

  if (forbidden) return forbidden;

  try {
    const body = (await request.json()) as {
      depositAmount?: unknown;
      method?: unknown;
      status?: unknown;
      bankId?: unknown;
      transferBank?: unknown;
      transferCurrency?: unknown;
      referenceCode?: unknown;
      proofImageUrl?: unknown;
      allocations?: Array<{ orderId?: unknown; amount?: unknown }>;
    };

    const depositAmount = toPositiveNumericString(body.depositAmount);

    if (!depositAmount) {
      return new Response("Deposit amount must be greater than 0", { status: 400 });
    }

    const method = String(body.method ?? "").trim().toUpperCase();

    if (!methods.has(method)) {
      return new Response("Invalid payment method", { status: 400 });
    }

    const status = "PENDIENTE";

    const bankId =
      body.bankId === undefined || body.bankId === null
        ? null
        : String(body.bankId).trim() || null;

    const transferCurrency =
      body.transferCurrency === undefined || body.transferCurrency === null
        ? null
        : String(body.transferCurrency).trim().toUpperCase() || null;

    const bankRow = bankId ? await resolvePaymentBankById(db, bankId) : null;

    if (method === "TRANSFERENCIA") {
      const bankValidationError = validatePaymentBankCurrency(
        bankRow,
        transferCurrency,
      );
      if (bankValidationError) {
        return new Response(bankValidationError, { status: 400 });
      }
    }

    const referenceCode =
      body.referenceCode === undefined || body.referenceCode === null
        ? null
        : String(body.referenceCode).trim() || null;

    const proofImageUrl =
      body.proofImageUrl === undefined || body.proofImageUrl === null
        ? null
        : String(body.proofImageUrl).trim() || null;

    const allocationsRaw = Array.isArray(body.allocations) ? body.allocations : [];

    const allocations = allocationsRaw
      .map((a) => ({
        orderId: String(a?.orderId ?? "").trim(),
        amount: toPositiveNumericString(a?.amount),
      }))
      .filter((a) => a.orderId && a.amount) as Array<{ orderId: string; amount: string }>;

    if (allocations.length === 0) {
      return new Response("At least one allocation is required", { status: 400 });
    }

    const assignedTotal = allocations.reduce((acc, item) => acc + Number(item.amount), 0);
    const depositTotal = Number(depositAmount);

    if (!Number.isFinite(assignedTotal) || assignedTotal <= 0) {
      return new Response("Invalid allocated total", { status: 400 });
    }

    if (assignedTotal > depositTotal) {
      return new Response("Allocated total cannot exceed deposit amount", { status: 400 });
    }

    const uniqueOrderIds = Array.from(new Set(allocations.map((a) => a.orderId)));

    const existingOrders = await db
      .select({ id: orders.id, clientId: orders.clientId })
      .from(orders)
      .where(inArray(orders.id, uniqueOrderIds));

    const existingSet = new Set(existingOrders.map((row) => String(row.id)));

    const invalidOrder = uniqueOrderIds.find((id) => !existingSet.has(id));

    if (invalidOrder) {
      return new Response("Invalid orderId in allocations", { status: 400 });
    }

    const clientIds = Array.from(
      new Set(existingOrders.map((row) => String(row.clientId ?? ""))),
    );

    if (clientIds.length !== 1 || !clientIds[0]) {
      return new Response(
        "All allocated orders must belong to the same client",
        { status: 400 },
      );
    }

    const inserted = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(orderPayments)
        .values(
          allocations.map((a) => ({
            orderId: a.orderId,
            amount: a.amount,
            depositAmount,
            referenceCode,
            method: method as any,
            bankId: method === "TRANSFERENCIA" ? bankRow?.id ?? null : null,
            transferBank: null,
            transferCurrency:
              method === "TRANSFERENCIA" ? transferCurrency : null,
            status: status as any,
            proofImageUrl,
          })) as any,
        )
        .returning({
          id: orderPayments.id,
          orderId: orderPayments.orderId,
          amount: orderPayments.amount,
        });

      return rows;
    });

    for (const orderId of uniqueOrderIds) {
      await syncOrderStatusByPayments(orderId);
    }

    return Response.json(
      {
        ok: true,
        count: inserted.length,
        assignedTotal: String(assignedTotal),
        depositAmount,
      },
      { status: 201 },
    );
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo registrar el abono distribuido", { status: 500 });
  }
}
