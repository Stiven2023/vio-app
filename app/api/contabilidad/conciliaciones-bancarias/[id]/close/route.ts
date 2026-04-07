import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { bankReconciliations } from "@/src/db/schema";
import {
  isAccountingConfigurationError,
  postConciliationAdjustmentEntry,
} from "@/src/utils/accounting-entries";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { jsonError } from "@/src/utils/api-error";
import { parseAccountingPeriod } from "@/src/utils/accounting-period";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "bank-reconciliations:close",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "CERRAR_CONCILIACION_BANCARIA",
  );

  if (forbidden) return forbidden;

  const { id } = await context.params;
  const reconciliationId = String(id ?? "").trim();

  if (!reconciliationId) {
    return jsonError(400, "VALIDATION_ERROR", "El id de la conciliación es obligatorio.", {
      id: ["El parámetro id es requerido."],
    });
  }

  const employeeId = getEmployeeIdFromRequest(request);

  try {
    const [existing] = await db
      .select({
        id: bankReconciliations.id,
        isClosed: bankReconciliations.isClosed,
        period: bankReconciliations.period,
        difference: bankReconciliations.difference,
      })
      .from(bankReconciliations)
      .where(eq(bankReconciliations.id, reconciliationId))
      .limit(1);

    if (!existing?.id) {
      return jsonError(404, "NOT_FOUND", "Conciliación bancaria no encontrada.");
    }

    if (existing.isClosed) {
      return jsonError(409, "RECONCILIATION_ALREADY_CLOSED", "La conciliación bancaria ya estaba cerrada.", {
        status: ["Solo es posible cerrar conciliaciones en estado abierto."],
      });
    }

    const closedAt = new Date().toISOString();
    const period = parseAccountingPeriod(existing.period + "-01") ?? existing.period;

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(bankReconciliations)
        .set({
          isClosed: true,
          closedAt: new Date(closedAt),
          closedBy: employeeId,
        })
        .where(eq(bankReconciliations.id, reconciliationId))
        .returning({
          id: bankReconciliations.id,
          isClosed: bankReconciliations.isClosed,
          difference: bankReconciliations.difference,
        });

      const diff = parseFloat(String(row.difference ?? "0"));

      // Solo genera asiento si hay diferencia real (> 1 centavo)
      let adjustmentEntry: { id: string; entryNumber: string } | null = null;

      if (Math.abs(diff) >= 0.01) {
        adjustmentEntry = await postConciliationAdjustmentEntry(
          tx,
          {
            reconciliationId,
            period,
            difference: row.difference ?? "0",
            closedAt,
          },
          employeeId,
        );
      }

      return { row, adjustmentEntry };
    });

    return Response.json({
      ok: true,
      id: updated.row.id,
      isClosed: updated.row.isClosed,
      difference: updated.row.difference,
      adjustmentEntryId: updated.adjustmentEntry?.id ?? null,
      adjustmentEntryNumber: updated.adjustmentEntry?.entryNumber ?? null,
    });
  } catch (error) {
    if (isAccountingConfigurationError(error)) {
      return jsonError(
        409,
        "ACCOUNTING_CONFIGURATION_MISSING",
        "Falta configuración contable para registrar el ajuste de conciliación.",
        { accounting: ["Configura las cuentas contables antes de cerrar la conciliación."] },
      );
    }

    const dbResponse = dbErrorResponse(error);

    if (dbResponse) return dbResponse;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo cerrar la conciliación bancaria.");
  }
}
