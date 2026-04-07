import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { factoringRecords } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  jsonNotFound,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import {
  getAccountingConfigurationFieldErrors,
  isAccountingConfigurationError,
  postFactoringCollectedEntry,
} from "@/src/utils/accounting-entries";
import { checkClientLegalStatus } from "@/src/utils/financial-guards";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const factoringStatusUpdateSchema = z.object({
  status: z.enum(["COLLECTED", "VOIDED"]),
  collectionDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD.")
    .optional(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "factoring:status:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_FACTORING");

  if (forbidden) return forbidden;

  const employeeId = getEmployeeIdFromRequest(request);

  const { id } = await context.params;
  const factoringId = String(id ?? "").trim();

  if (!factoringId) {
    return jsonError(400, "VALIDATION_ERROR", "El id del registro es obligatorio.", {
      id: ["Debes indicar el registro de factoring a actualizar."],
    });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "El cuerpo JSON es inválido.");
  }

  const parsed = factoringStatusUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Los datos del estado son inválidos.",
    );
  }

  const { status, collectionDate } = parsed.data;

  try {
    const [existing] = await db
      .select({
        id: factoringRecords.id,
        factoringCode: factoringRecords.factoringCode,
        status: factoringRecords.status,
        clientId: factoringRecords.clientId,
        invoiceValue: factoringRecords.invoiceValue,
        netAmountReceived: factoringRecords.netAmountReceived,
        assignmentDate: factoringRecords.assignmentDate,
      })
      .from(factoringRecords)
      .where(eq(factoringRecords.id, factoringId))
      .limit(1);

    if (!existing?.id) {
      return jsonNotFound("Registro de factoring no encontrado.");
    }

    if (existing.status !== "ACTIVE") {
      return jsonError(
        409,
        "FACTORING_INVALID_STATE_TRANSITION",
        `El registro ya tiene estado ${existing.status} y no puede actualizarse.`,
        {
          status: ["Solo se pueden actualizar registros con estado ACTIVE."],
        },
      );
    }

    // Verificar estado legal del cliente antes de cobrar
    if (status === "COLLECTED" && existing.clientId) {
      const legalCheck = await checkClientLegalStatus(existing.clientId);

      if (legalCheck.blocked) {
        return jsonError(
          409,
          "CLIENT_LEGALLY_BLOCKED",
          legalCheck.reason,
          { client: [legalCheck.reason] },
        );
      }
    }

    const effectiveDate =
      collectionDate ??
      new Date().toISOString().slice(0, 10);

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(factoringRecords)
        .set({ status })
        .where(
          and(
            eq(factoringRecords.id, factoringId),
            eq(factoringRecords.status, "ACTIVE"),
          ),
        )
        .returning({
          id: factoringRecords.id,
          status: factoringRecords.status,
          factoringCode: factoringRecords.factoringCode,
        });

      if (status === "COLLECTED" && row?.id) {
        await postFactoringCollectedEntry(
          tx,
          {
            factoringId,
            factoringCode: String(existing.factoringCode ?? factoringId),
            clientId: String(existing.clientId),
            collectionDate: effectiveDate,
            invoiceValue: String(existing.invoiceValue ?? "0"),
            netAmountReceived: String(existing.netAmountReceived ?? "0"),
          },
          employeeId,
        );
      }

      return [row];
    });

    if (!updated?.id) {
      return jsonError(
        409,
        "FACTORING_INVALID_STATE_TRANSITION",
        "No se pudo actualizar el estado. El registro puede ya no estar ACTIVE.",
        { status: ["Intenta recargar y volver a intentarlo."] },
      );
    }

    return Response.json({
      ok: true,
      id: updated.id,
      status: updated.status,
    });
  } catch (error) {
    if (isAccountingConfigurationError(error)) {
      return jsonError(
        409,
        "ACCOUNTING_CONFIGURATION_MISSING",
        error instanceof Error
          ? error.message
          : "Falta configuración contable para registrar el factoring.",
        getAccountingConfigurationFieldErrors(error),
      );
    }

    const response = dbJsonError(
      error,
      "No se pudo actualizar el estado del factoring.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo actualizar el estado del factoring.",
    );
  }
}

