import { inArray } from "drizzle-orm";

import { db } from "@/src/db";
import { orderPayments, orders } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import {
  resolvePaymentBankById,
  validatePaymentBankCurrency,
} from "@/src/utils/payment-banks";
import { generatePaymentReferenceCodes } from "@/src/utils/payment-reference-code";
import { rateLimit } from "@/src/utils/rate-limit";
import { hasDuplicateOrderAllocations } from "@/src/utils/business-rule-guards";

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
      return new Response("Deposit amount must be greater than 0", {
        status: 400,
      });
    }

    const method = String(body.method ?? "")
      .trim()
      .toUpperCase();

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

    const proofImageUrl =
      body.proofImageUrl === undefined || body.proofImageUrl === null
        ? null
        : String(body.proofImageUrl).trim() || null;

    const allocationsRaw = Array.isArray(body.allocations)
      ? body.allocations
      : [];

    const allocations = allocationsRaw
      .map((a) => ({
        orderId: String(a?.orderId ?? "").trim(),
        amount: toPositiveNumericString(a?.amount),
      }))
      .filter((a) => a.orderId && a.amount) as Array<{
      orderId: string;
      amount: string;
    }>;

    if (allocations.length === 0) {
      return new Response("At least one allocation is required", {
        status: 400,
      });
    }

    // Validate that each orderId appears only once (prevent double-payment)
    if (hasDuplicateOrderAllocations(allocations)) {
      return new Response(
        "Duplicate orderId in allocations (each order can only be paid once per deposit)",
        { status: 400 },
      );
    }
    const orderIdSet = new Set(allocations.map((a) => a.orderId));

    const assignedTotal = allocations.reduce(
      (acc, item) => acc + Number(item.amount),
      0,
    );
    const depositTotal = Number(depositAmount);

    if (!Number.isFinite(assignedTotal) || assignedTotal <= 0) {
      return new Response("Invalid allocated total", { status: 400 });
    }

    if (assignedTotal > depositTotal) {
      return new Response("Allocated total cannot exceed deposit amount", {
        status: 400,
      });
    }

    const uniqueOrderIds = Array.from(orderIdSet);

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
      const generatedReferenceCodes = await generatePaymentReferenceCodes(tx, {
        method: method as "EFECTIVO" | "TRANSFERENCIA" | "CREDITO",
        bankIsOfficial: bankRow?.isOfficial ?? null,
        count: allocations.length,
      });

      const rows = await tx
        .insert(orderPayments)
        .values(
          allocations.map((a, index) => ({
            orderId: a.orderId,
            amount: a.amount,
            depositAmount,
            referenceCode: generatedReferenceCodes[index],
            method: method as any,
            bankId: method === "TRANSFERENCIA" ? (bankRow?.id ?? null) : null,
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

    return new Response("No se pudo registrar el abono distribuido", {
      status: 500,
    });
  }
}
