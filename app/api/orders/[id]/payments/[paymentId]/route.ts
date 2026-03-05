import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { orderPayments, orders, orderStatusHistory, prefacturas } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import {
  canSetPaymentStatusOnApproval,
  isConfirmedPaymentStatus,
} from "@/src/utils/payment-status";
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
const statuses = new Set(["PENDIENTE", "PARCIAL", "PAGADO", "ANULADO"]);
const transferCurrencies = new Set(["COP", "USD"]);
const transferBanks = new Set(["GC 24-25", "O 29-52", "VIO-EXT."]);

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-payments:put",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { paymentId } = await params;
  const pid = String(paymentId ?? "").trim();

  if (!pid) return new Response("paymentId required", { status: 400 });

  const body = (await request.json()) as any;
  const wantsStatusChange = body.status !== undefined;

  if (wantsStatusChange) {
    const forbiddenApprove = await requirePermission(request, "APROBAR_PAGO");
    if (forbiddenApprove) return forbiddenApprove;
  }

  const wantsEditFields =
    body.amount !== undefined ||
    body.method !== undefined ||
    body.proofImageUrl !== undefined ||
    body.referenceCode !== undefined ||
    body.depositAmount !== undefined ||
    body.transferBank !== undefined ||
    body.transferCurrency !== undefined;

  if (wantsEditFields) {
    const forbiddenEdit = await requirePermission(request, "EDITAR_PAGO");
    if (forbiddenEdit) return forbiddenEdit;
  }

  const patch: Partial<typeof orderPayments.$inferInsert> = {};

  if (body.amount !== undefined) {
    const amount = toPositiveNumericString(body.amount);

    if (!amount) return new Response("amount must be > 0", { status: 400 });

    patch.amount = amount;
  }

  if (body.method !== undefined) {
    const method = String(body.method ?? "")
      .trim()
      .toUpperCase();

    if (!methods.has(method))
      return new Response("invalid method", { status: 400 });

    patch.method = method as any;
  }

  if (body.status !== undefined) {
    const status = String(body.status ?? "")
      .trim()
      .toUpperCase();

    if (!statuses.has(status))
      return new Response("invalid status", { status: 400 });

    if (!canSetPaymentStatusOnApproval(status)) {
      return new Response("status must be PAGADO or ANULADO", { status: 400 });
    }

    patch.status = status as any;
  }

  if (body.proofImageUrl !== undefined) {
    const url =
      body.proofImageUrl === null ? null : String(body.proofImageUrl).trim();

    patch.proofImageUrl = url ? url : null;
  }

  if (body.referenceCode !== undefined) {
    const code =
      body.referenceCode === null ? null : String(body.referenceCode).trim();

    patch.referenceCode = code ? code : null;
  }

  if (body.depositAmount !== undefined) {
    const depositAmount = toPositiveNumericString(body.depositAmount);

    if (!depositAmount) {
      return new Response("depositAmount must be > 0", { status: 400 });
    }

    patch.depositAmount = depositAmount;
  }

  if (body.transferBank !== undefined) {
    const bank =
      body.transferBank === null ? null : String(body.transferBank).trim() || null;

    if (bank && !transferBanks.has(bank)) {
      return new Response("transferBank inválido", { status: 400 });
    }

    patch.transferBank = bank;
  }

  if (body.transferCurrency !== undefined) {
    const currency =
      body.transferCurrency === null
        ? null
        : String(body.transferCurrency).trim().toUpperCase() || null;

    if (currency && !transferCurrencies.has(currency)) {
      return new Response("transferCurrency must be COP or USD", { status: 400 });
    }

    patch.transferCurrency = currency;
  }

  const methodAfterPatch = patch.method
    ? String(patch.method)
    : null;

  if (
    methodAfterPatch === "TRANSFERENCIA" ||
    patch.transferBank !== undefined ||
    patch.transferCurrency !== undefined
  ) {
    const [current] = await db
      .select({
        method: orderPayments.method,
        transferBank: orderPayments.transferBank,
        transferCurrency: orderPayments.transferCurrency,
      })
      .from(orderPayments)
      .where(eq(orderPayments.id, pid))
      .limit(1);

    if (!current) return new Response("Not found", { status: 404 });

    const effectiveMethod = methodAfterPatch ?? String(current.method ?? "");
    const effectiveBank =
      patch.transferBank !== undefined ? patch.transferBank : current.transferBank;
    const effectiveCurrency =
      patch.transferCurrency !== undefined
        ? patch.transferCurrency
        : current.transferCurrency;

    if (effectiveMethod === "TRANSFERENCIA") {
      if (!String(effectiveBank ?? "").trim() || !transferBanks.has(String(effectiveBank))) {
        return new Response("transferBank required for transfer method", {
          status: 400,
        });
      }

      if (!effectiveCurrency || !transferCurrencies.has(String(effectiveCurrency))) {
        return new Response("transferCurrency must be COP or USD", {
          status: 400,
        });
      }

      if (String(effectiveCurrency) === "USD" && String(effectiveBank) !== "VIO-EXT.") {
        return new Response("USD solo se acepta cuando el banco es VIO-EXT.", {
          status: 400,
        });
      }

      if (String(effectiveBank) === "VIO-EXT." && String(effectiveCurrency) !== "USD") {
        return new Response("Con banco VIO-EXT. solo se acepta moneda USD.", {
          status: 400,
        });
      }
    }

    if (effectiveMethod !== "TRANSFERENCIA") {
      patch.transferBank = null;
      patch.transferCurrency = null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return new Response("No fields to update", { status: 400 });
  }

  const [updated] = await db
    .update(orderPayments)
    .set(patch)
    .where(eq(orderPayments.id, pid))
    .returning();

  if (!updated) return new Response("Not found", { status: 404 });

  if (updated.orderId) {
    await syncOrderStatusByPayments(String(updated.orderId));
  }

  return Response.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-payments:delete",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PAGO");

  if (forbidden) return forbidden;

  const { paymentId } = await params;
  const pid = String(paymentId ?? "").trim();

  if (!pid) return new Response("paymentId required", { status: 400 });

  const [deleted] = await db
    .delete(orderPayments)
    .where(eq(orderPayments.id, pid))
    .returning();

  if (!deleted) return new Response("Not found", { status: 404 });

  if (deleted.orderId) {
    await syncOrderStatusByPayments(String(deleted.orderId));
  }

  return Response.json(deleted);
}
