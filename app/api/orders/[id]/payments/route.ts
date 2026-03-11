import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  banks,
  orderPayments,
  orders,
  orderStatusHistory,
  prefacturas,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import {
  resolvePaymentBankById,
  validatePaymentBankCurrency,
} from "@/src/utils/payment-banks";
import { isConfirmedPaymentStatus } from "@/src/utils/payment-status";
import { rateLimit } from "@/src/utils/rate-limit";
import { createNotificationsForPermission } from "@/src/utils/notifications";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-payments:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PAGO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const { id } = await params;
    const orderId = String(id ?? "").trim();

    if (!orderId) return new Response("Order ID is required", { status: 400 });

    const where = and(eq(orderPayments.orderId, orderId));

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(orderPayments)
      .where(where);

    const [orderSummary] = await db
      .select({ total: orders.total })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    const paymentRows = await db
      .select({ amount: orderPayments.amount, status: orderPayments.status })
      .from(orderPayments)
      .where(eq(orderPayments.orderId, orderId));

    const paidTotal = paymentRows.reduce((acc, row) => {
      if (!isConfirmedPaymentStatus(row.status)) return acc;
      const amount = Number(row.amount ?? 0);
      return acc + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    const items = await db
      .select({
        id: orderPayments.id,
        orderId: orderPayments.orderId,
        amount: orderPayments.amount,
        depositAmount: orderPayments.depositAmount,
        referenceCode: orderPayments.referenceCode,
        method: orderPayments.method,
        bankId: orderPayments.bankId,
        bankCode: banks.code,
        bankName: banks.name,
        bankAccountRef: banks.accountRef,
        transferCurrency: orderPayments.transferCurrency,
        status: orderPayments.status,
        proofImageUrl: orderPayments.proofImageUrl,
        createdAt: orderPayments.createdAt,
      })
      .from(orderPayments)
      .leftJoin(banks, eq(orderPayments.bankId, banks.id))
      .where(where)
      .orderBy(desc(orderPayments.createdAt))
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({
      items,
      page,
      pageSize,
      total,
      hasNextPage,
      orderTotal: String(orderSummary?.total ?? "0"),
      paidTotal: String(paidTotal),
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("Failed to fetch payments", { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-payments:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PAGO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderId = String(id ?? "").trim();

  if (!orderId) return new Response("Order ID is required", { status: 400 });

  const body = (await request.json()) as any;

  const amount = toPositiveNumericString(body.amount);

  if (!amount) return new Response("Amount must be greater than 0", { status: 400 });

  const method = String(body.method ?? "")
    .trim()
    .toUpperCase();

  if (!methods.has(method)) {
    return new Response("Invalid payment method", { status: 400 });
  }

  const status = "PENDIENTE";

  const proofImageUrl =
    body.proofImageUrl === undefined || body.proofImageUrl === null
      ? null
      : String(body.proofImageUrl).trim() || null;

  const referenceCode =
    body.referenceCode === undefined || body.referenceCode === null
      ? null
      : String(body.referenceCode).trim() || null;

  const depositAmount =
    toPositiveNumericString(body.depositAmount) ?? amount;

  const bankId =
    body.bankId === undefined || body.bankId === null
      ? null
      : String(body.bankId).trim() || null;

  const transferCurrencyRaw =
    body.transferCurrency === undefined || body.transferCurrency === null
      ? null
      : String(body.transferCurrency).trim().toUpperCase() || null;
  const transferCurrency = transferCurrencyRaw;

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

  const created = await db.transaction(async (tx) => {
    const [o] = await tx
      .select({ id: orders.id, orderCode: orders.orderCode })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!o) throw new Error("order not found");

    const [p] = await tx
      .insert(orderPayments)
      .values({
        orderId,
        amount,
        depositAmount,
        referenceCode,
        method: method as any,
        bankId: method === "TRANSFERENCIA" ? bankRow?.id ?? null : null,
        transferBank: null,
        transferCurrency:
          method === "TRANSFERENCIA" && transferCurrency
            ? transferCurrency
            : null,
        status: status as any,
        proofImageUrl,
      })
      .returning();

    return { payment: p, orderCode: o.orderCode };
  });

  await syncOrderStatusByPayments(orderId);

  await createNotificationsForPermission("VER_PAGO", {
    title: "Pago registrado",
    message: `Se registró un pago para el pedido ${created.orderCode}.`,
    href: `/orders/${orderId}/payments`,
  });

  return Response.json(created.payment, { status: 201 });
}
