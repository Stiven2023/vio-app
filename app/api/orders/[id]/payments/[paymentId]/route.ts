import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { orderPayments } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import {
  resolvePaymentBankById,
  validatePaymentBankCurrency,
} from "@/src/utils/payment-banks";
import {
  canSetPaymentStatusOnApproval,
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

  if (!pid) return new Response("Payment ID is required", { status: 400 });

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
    body.bankId !== undefined ||
    body.transferCurrency !== undefined;

  if (wantsEditFields) {
    const forbiddenEdit = await requirePermission(request, "EDITAR_PAGO");
    if (forbiddenEdit) return forbiddenEdit;
  }

  const patch: Partial<typeof orderPayments.$inferInsert> = {};

  if (body.amount !== undefined) {
    const amount = toPositiveNumericString(body.amount);

    if (!amount) return new Response("Amount must be greater than 0", { status: 400 });

    patch.amount = amount;
  }

  if (body.method !== undefined) {
    const method = String(body.method ?? "")
      .trim()
      .toUpperCase();

    if (!methods.has(method))
      return new Response("Invalid payment method", { status: 400 });

    patch.method = method as any;
  }

  if (body.status !== undefined) {
    const status = String(body.status ?? "")
      .trim()
      .toUpperCase();

    if (!statuses.has(status))
      return new Response("Invalid payment status", { status: 400 });

    if (!canSetPaymentStatusOnApproval(status)) {
      return new Response("Status must be PAGADO or ANULADO", { status: 400 });
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
      return new Response("Deposit amount must be greater than 0", { status: 400 });
    }

    patch.depositAmount = depositAmount;
  }

  if (body.bankId !== undefined) {
    const bankId =
      body.bankId === null ? null : String(body.bankId).trim() || null;

    if (!bankId) {
      patch.bankId = null;
      patch.transferBank = null;
    } else {
      const bank = await resolvePaymentBankById(db, bankId);

      if (!bank) {
        return new Response("Invalid bank", { status: 400 });
      }

      patch.bankId = bank.id;
      patch.transferBank = null;
    }
  }

  if (body.transferCurrency !== undefined) {
    const currency =
      body.transferCurrency === null
        ? null
        : String(body.transferCurrency).trim().toUpperCase() || null;

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
        bankId: orderPayments.bankId,
        transferCurrency: orderPayments.transferCurrency,
      })
      .from(orderPayments)
      .where(eq(orderPayments.id, pid))
      .limit(1);

    if (!current) return new Response("Payment not found", { status: 404 });

    const effectiveMethod = methodAfterPatch ?? String(current.method ?? "");
    const effectiveBankId =
      patch.bankId !== undefined ? patch.bankId : current.bankId;
    const effectiveCurrency =
      patch.transferCurrency !== undefined
        ? patch.transferCurrency
        : current.transferCurrency;

    if (effectiveMethod === "TRANSFERENCIA") {
      const effectiveBank = effectiveBankId
        ? await resolvePaymentBankById(db, String(effectiveBankId))
        : null;

      const bankValidationError = validatePaymentBankCurrency(
        effectiveBank,
        effectiveCurrency ? String(effectiveCurrency) : null,
      );
      if (bankValidationError) {
        return new Response(bankValidationError, { status: 400 });
      }

      patch.bankId = effectiveBank?.id ?? null;
      patch.transferBank = null;
    }

    if (effectiveMethod !== "TRANSFERENCIA") {
      patch.bankId = null;
      patch.transferBank = null;
      patch.transferCurrency = null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return new Response("No fields provided for update", { status: 400 });
  }

  const [updated] = await db
    .update(orderPayments)
    .set(patch)
    .where(eq(orderPayments.id, pid))
    .returning();

  if (!updated) return new Response("Payment not found", { status: 404 });

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

  if (!pid) return new Response("Payment ID is required", { status: 400 });

  const [deleted] = await db
    .delete(orderPayments)
    .where(eq(orderPayments.id, pid))
    .returning();

  if (!deleted) return new Response("Payment not found", { status: 404 });

  return Response.json(deleted);
}
