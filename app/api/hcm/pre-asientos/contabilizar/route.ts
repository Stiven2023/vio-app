import { eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import { hcmPreAsientos } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  jsonForbidden,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { assertAccountingPeriodOpen } from "@/src/utils/accounting-period";
import {
  getAccountingConfigurationFieldErrors,
  isAccountingConfigurationError,
  postHcmPreAsientoEntry,
} from "@/src/utils/accounting-entries";
import { resolveEmployeeIdFromRequest } from "@/src/utils/employee-session";
import { hcmContabilizarPreAsientosSchema } from "@/src/utils/hcm-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function entryDateFromPeriod(period: string) {
  return `${period}-01`;
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "hcm:pre-asientos:contabilizar:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "CREAR_PROVISIONES_NOMINA",
  );

  if (forbidden) return jsonForbidden();

  const body = (await request.json().catch(() => null)) as unknown;

  if (body === null) {
    return jsonError(400, "INVALID_JSON", "El cuerpo JSON es inválido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = hcmContabilizarPreAsientosSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Datos de contabilización inválidos.",
    );
  }

  const actorEmployeeId = await resolveEmployeeIdFromRequest(request);
  const posted: Array<{
    id: string;
    accountingEntryId: string;
    entryNumber: string;
  }> = [];
  const failed: Array<Record<string, unknown>> = [];

  try {
    const rows = await db
      .select({
        id: hcmPreAsientos.id,
        employeeId: hcmPreAsientos.employeeId,
        period: hcmPreAsientos.period,
        status: hcmPreAsientos.status,
        cuentaDebito: hcmPreAsientos.cuentaDebito,
        cuentaCredito: hcmPreAsientos.cuentaCredito,
        valor: hcmPreAsientos.valor,
        concepto: hcmPreAsientos.concepto,
        accountingEntryId: hcmPreAsientos.accountingEntryId,
      })
      .from(hcmPreAsientos)
      .where(inArray(hcmPreAsientos.id, parsed.data.preAsientoIds));

    const byId = new Map(rows.map((row) => [row.id, row]));

    for (const preAsientoId of parsed.data.preAsientoIds) {
      const preAsiento = byId.get(preAsientoId);

      if (!preAsiento) {
        failed.push({
          id: preAsientoId,
          code: "NOT_FOUND",
          message: "Pre-asiento no encontrado.",
        });
        continue;
      }

      if (
        preAsiento.status === "CONTABILIZADO" &&
        preAsiento.accountingEntryId
      ) {
        posted.push({
          id: preAsiento.id,
          accountingEntryId: preAsiento.accountingEntryId,
          entryNumber: "IDEMPOTENT",
        });
        continue;
      }

      if (preAsiento.status !== "APROBADO") {
        failed.push({
          id: preAsiento.id,
          code: "HCM_PRE_ASIENTO_INVALID_STATUS",
          message: "Solo se pueden contabilizar pre-asientos APROBADOS.",
          fieldErrors: {
            status: ["Estado actual no permite contabilización."],
          },
        });
        continue;
      }

      const periodResponse = await assertAccountingPeriodOpen(
        db,
        preAsiento.period,
        {
          fieldName: "period",
          code: "ACCOUNTING_PERIOD_CLOSED",
        },
      );

      if (periodResponse) {
        const payload = (await periodResponse.json()) as Record<
          string,
          unknown
        >;

        failed.push({ id: preAsiento.id, ...payload });
        continue;
      }

      try {
        const entry = await db.transaction(async (tx) => {
          const postedEntry = await postHcmPreAsientoEntry(
            tx,
            {
              preAsientoId: preAsiento.id,
              period: preAsiento.period,
              entryDate: entryDateFromPeriod(preAsiento.period),
              employeeId: preAsiento.employeeId,
              accountDebitCode: preAsiento.cuentaDebito,
              accountCreditCode: preAsiento.cuentaCredito,
              amount: preAsiento.valor,
              concept: preAsiento.concepto,
            },
            actorEmployeeId,
          );

          await tx
            .update(hcmPreAsientos)
            .set({
              status: "CONTABILIZADO",
              accountingEntryId: postedEntry.id,
              updatedAt: new Date(),
            })
            .where(eq(hcmPreAsientos.id, preAsiento.id));

          return postedEntry;
        });

        posted.push({
          id: preAsiento.id,
          accountingEntryId: entry.id,
          entryNumber: entry.entryNumber,
        });
      } catch (error) {
        if (isAccountingConfigurationError(error)) {
          failed.push({
            id: preAsiento.id,
            code: "ACCOUNTING_CONFIGURATION_MISSING",
            message:
              error instanceof Error
                ? error.message
                : "Falta configuración contable para contabilizar.",
            fieldErrors: getAccountingConfigurationFieldErrors(error),
          });
          continue;
        }

        throw error;
      }
    }

    if (posted.length === 0 && failed.length > 0) {
      return jsonError(
        409,
        "HCM_PRE_ASIENTO_POSTING_FAILED",
        "No se pudo contabilizar ningún pre-asiento.",
        {
          preAsientoIds: failed.map((item) => String(item.id)),
        },
      );
    }

    return Response.json({
      posted,
      failed,
      summary: {
        requested: parsed.data.preAsientoIds.length,
        posted: posted.length,
        failed: failed.length,
      },
    });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudo contabilizar pre-asientos HCM.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo contabilizar pre-asientos HCM.",
    );
  }
}
