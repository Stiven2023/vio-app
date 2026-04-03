import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  cashReceiptApplications,
  cashReceipts,
  preInvoices,
} from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbJsonError, jsonError, jsonNotFound, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  getAccountingConfigurationFieldErrors,
  getCashReceiptPostingPayload,
  isAccountingConfigurationError,
  postCashReceiptAccountingEntry,
  reverseCashReceiptAccountingEntry,
} from "@/src/utils/accounting-entries";
import { assertAccountingPeriodOpen, getAccountingPeriodFromDate } from "@/src/utils/accounting-period";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type NextStatus = "CONFIRMED" | "VOIDED";

const statusUpdateSchema = z.object({
  status: z.enum(["CONFIRMED", "VOIDED"]),
});

function prefacturaAmountExpr() {
  return sql`case when coalesce(${preInvoices.totalAfterWithholdings}, 0) > 0 then coalesce(${preInvoices.totalAfterWithholdings}, 0) else coalesce(${preInvoices.total}, 0) end`;
}

async function getOutstandingBalances(prefacturaIds: string[]) {
  if (prefacturaIds.length === 0) return new Map<string, number>();

  const totalExpr = prefacturaAmountExpr();
  const rows = await db
    .select({
      id: preInvoices.id,
      total: totalExpr,
      applied: sql<string>`coalesce(sum(case when ${cashReceipts.status} = 'CONFIRMED' then ${cashReceiptApplications.appliedAmount} else 0 end), 0)::text`,
    })
    .from(preInvoices)
    .leftJoin(
      cashReceiptApplications,
      eq(cashReceiptApplications.prefacturaId, preInvoices.id),
    )
    .leftJoin(
      cashReceipts,
      eq(cashReceiptApplications.cashReceiptId, cashReceipts.id),
    )
    .where(inArray(preInvoices.id, prefacturaIds))
    .groupBy(preInvoices.id);

  return new Map(
    rows.map((row) => {
      const total = Number(row.total ?? 0);
      const applied = Number(row.applied ?? 0);

      return [row.id, Math.max(0, total - applied)];
    }),
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "cash-receipts:status:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  try {
    const { id } = await context.params;
    const receiptId = String(id ?? "").trim();
    const employeeId = getEmployeeIdFromRequest(request);

    if (!receiptId) {
      return jsonError(400, "VALIDATION_ERROR", "El recibo es obligatorio.", {
        id: ["Debes indicar el recibo a actualizar."],
      });
    }

    const body = await request.json();
    const parsed = statusUpdateSchema.safeParse({
      status: String((body as Record<string, unknown> | null)?.status ?? "")
        .trim()
        .toUpperCase(),
    });

    if (!parsed.success) {
      return zodFirstErrorEnvelope(parsed.error, "Los datos del estado son inválidos.");
    }

    const status = parsed.data.status as NextStatus;

    const forbidden = await requirePermission(
      request,
      status === "VOIDED" ? "ANULAR_RECIBO_CAJA" : "CREAR_RECIBO_CAJA",
    );

    if (forbidden) return forbidden;

    const [receipt] = await db
      .select({
        id: cashReceipts.id,
        status: cashReceipts.status,
        amountReceived: cashReceipts.amountReceived,
        receiptDate: cashReceipts.receiptDate,
      })
      .from(cashReceipts)
      .where(eq(cashReceipts.id, receiptId))
      .limit(1);

    if (!receipt?.id) {
      return jsonNotFound("El recibo de caja no existe.");
    }

    if (String(receipt.status ?? "") === status) {
      return jsonError(
        409,
        "INVALID_STATE_TRANSITION",
        "El recibo ya tiene el estado solicitado.",
      );
    }

    if (String(receipt.status ?? "") === "VOIDED" && status === "CONFIRMED") {
      return jsonError(
        409,
        "INVALID_STATE_TRANSITION",
        "No se puede confirmar un recibo anulado.",
      );
    }

    const applications = await db
      .select({
        prefacturaId: cashReceiptApplications.prefacturaId,
        appliedAmount: cashReceiptApplications.appliedAmount,
      })
      .from(cashReceiptApplications)
      .where(eq(cashReceiptApplications.cashReceiptId, receiptId));

    if (status === "CONFIRMED") {
      const prefacturaIds = applications
        .map((item) => String(item.prefacturaId ?? "").trim())
        .filter(Boolean);
      const outstandingByPrefactura =
        await getOutstandingBalances(prefacturaIds);

      for (const application of applications) {
        const prefacturaId = String(application.prefacturaId ?? "").trim();
        const amount = Number(application.appliedAmount ?? 0);
        const outstanding = outstandingByPrefactura.get(prefacturaId) ?? 0;

        if (amount > outstanding + 0.0001) {
          return jsonError(
            409,
            "OUTSTANDING_BALANCE_CONFLICT",
            "No se puede confirmar el recibo porque una aplicación excede el saldo pendiente actual.",
            {
              applications: [
                "Una aplicación supera el saldo pendiente disponible.",
              ],
            },
          );
        }
      }
    }

    const accountingPeriod = getAccountingPeriodFromDate(
      new Date(String(receipt.receiptDate ?? new Date().toISOString())),
    );

    if (accountingPeriod) {
      const periodResponse = await assertAccountingPeriodOpen(db, accountingPeriod, {
        fieldName: "receiptDate",
        message:
          "El período contable del recibo está cerrado. Registra un ajuste formal o usa un período abierto.",
      });

      if (periodResponse) return periodResponse;
    }

    const [updated] = await db.transaction(async (tx) => {
      const [receiptRow] = await tx
        .update(cashReceipts)
        .set({ status })
        .where(eq(cashReceipts.id, receiptId))
        .returning({
          id: cashReceipts.id,
          status: cashReceipts.status,
          receiptDate: cashReceipts.receiptDate,
          receiptCode: cashReceipts.receiptCode,
        });

      if (status === "CONFIRMED") {
        const payload = await getCashReceiptPostingPayload(tx, receiptId);

        if (!payload) {
          throw new Error("cash_receipt_payload_missing");
        }

        await postCashReceiptAccountingEntry(tx, payload, employeeId);
      }

      if (status === "VOIDED" && String(receipt.status ?? "") === "CONFIRMED") {
        await reverseCashReceiptAccountingEntry(tx, {
          receiptId,
          receiptCode: receiptRow.receiptCode,
          voidDate: String(receiptRow.receiptDate),
          employeeId,
        });
      }

      return [receiptRow];
    });

    return Response.json({ ok: true, id: updated.id, status: updated.status });
  } catch (error) {
    if (isAccountingConfigurationError(error)) {
      return jsonError(
        409,
        "ACCOUNTING_CONFIGURATION_MISSING",
        error instanceof Error
          ? error.message
          : "Falta configuración contable para registrar el cobro.",
        getAccountingConfigurationFieldErrors(error),
      );
    }

    const response = dbJsonError(error, "No se pudo actualizar el estado del recibo.");

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo actualizar el estado del recibo.",
    );
  }
}
