import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { orders, orderPayments } from "@/src/db/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbJsonError, jsonError, jsonNotFound, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  getAccountingConfigurationFieldErrors,
  getOrderPaymentPostingPayload,
  isAccountingConfigurationError,
  postOrderPaymentAccountingEntry,
  reverseOrderPaymentAccountingEntry,
} from "@/src/utils/accounting-entries";
import { checkClientLegalStatus } from "@/src/utils/financial-guards";
import { requirePermission } from "@/src/utils/permission-middleware";
import { canSetPaymentStatusOnApproval } from "@/src/utils/payment-status";
import { rateLimit } from "@/src/utils/rate-limit";

const statusUpdateSchema = z.object({
  status: z.enum(["PAGADO", "ANULADO"]),
});

function normalizeStatus(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "contabilidad:consignaciones:status:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "APROBAR_PAGO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const paymentId = String(id ?? "").trim();

  if (!paymentId) {
    return jsonError(400, "VALIDATION_ERROR", "El pago es obligatorio.", {
      id: ["Debes indicar el pago a actualizar."],
    });
  }

  try {
    const employeeId = getEmployeeIdFromRequest(request);
    const body = await request.json();
    const parsed = statusUpdateSchema.safeParse({
      status: normalizeStatus((body as Record<string, unknown> | null)?.status),
    });

    if (!parsed.success) {
      return zodFirstErrorEnvelope(
        parsed.error,
        "Los datos del estado son inválidos.",
      );
    }

    const status = parsed.data.status;

    if (!canSetPaymentStatusOnApproval(status)) {
      return jsonError(
        422,
        "INVALID_STATE_TRANSITION",
        "El estado solo puede cambiarse a PAGADO o ANULADO.",
        {
          status: ["Estado no permitido para aprobación."],
        },
      );
    }

    const [existing] = await db
      .select({
        id: orderPayments.id,
        status: orderPayments.status,
        clientId: orders.clientId,
      })
      .from(orderPayments)
      .leftJoin(orders, eq(orderPayments.orderId, orders.id))
      .where(eq(orderPayments.id, paymentId))
      .limit(1);

    if (!existing?.id) {
      return jsonNotFound("Consignación no encontrada.");
    }

    // Verificar estado legal del cliente antes de aprobar
    if (status === "PAGADO" && existing.clientId) {
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

    const previousStatus = String(existing.status ?? "").toUpperCase();

    if (previousStatus === status) {
      return jsonError(
        409,
        "INVALID_STATE_TRANSITION",
        "El pago ya tiene el estado solicitado.",
      );
    }

    const [updated] = await db.transaction(async (tx) => {
      const [paymentRow] = await tx
        .update(orderPayments)
        .set({ status: status as any })
        .where(eq(orderPayments.id, paymentId))
        .returning({
          id: orderPayments.id,
          status: orderPayments.status,
          orderId: orderPayments.orderId,
          referenceCode: orderPayments.referenceCode,
          createdAt: orderPayments.createdAt,
        });

      if (status === "PAGADO") {
        const payload = await getOrderPaymentPostingPayload(tx, paymentId);

        if (!payload) {
          throw new Error("order_payment_payload_missing");
        }

        await postOrderPaymentAccountingEntry(tx, payload, employeeId);
      }

      if (status === "ANULADO" && previousStatus === "PAGADO") {
        await reverseOrderPaymentAccountingEntry(tx, {
          paymentId,
          paymentDate: new Date(
            String(paymentRow.createdAt ?? new Date().toISOString()),
          )
            .toISOString()
            .slice(0, 10),
          referenceCode: paymentRow.referenceCode
            ? String(paymentRow.referenceCode)
            : null,
          employeeId,
        });
      }

      return [paymentRow];
    });

    if (!updated) return jsonNotFound("Consignación no encontrada.");

    return Response.json({ ok: true, id: updated.id, status: updated.status });
  } catch (error) {
    if (isAccountingConfigurationError(error)) {
      return jsonError(
        409,
        "ACCOUNTING_CONFIGURATION_MISSING",
        error instanceof Error
          ? error.message
          : "Falta configuración contable para registrar la consignación.",
        getAccountingConfigurationFieldErrors(error),
      );
    }

    const response = dbJsonError(
      error,
      "No se pudo actualizar el estado de la consignación.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo actualizar el estado de la consignación.",
    );
  }
}
