/**
 * PATCH /api/mes/envios/[id]  — update status (EN_RUTA, ENTREGADO, RETORNADO, INCIDENTE)
 */
import { eq, inArray, sql } from "drizzle-orm";

import { erpDb, mesDb } from "@/src/db";
import { clientLegalStatus, orderItems, preInvoices } from "@/src/db/erp/schema";
import { mesItemTags, mesShipmentItems, mesShipments } from "@/src/db/mes/schema";
import { dbJsonError, jsonError, jsonForbidden, jsonNotFound, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import {
  getDispatchBlockingRule,
  hasAccountingApproval,
  isDispatchShipment,
  isValidEnvioStatusTransition,
  mesEnvioUpdateSchema,
  normalizeDispatchApprovals,
  toValidDate,
} from "@/src/utils/mes-workflow";
import { rateLimit } from "@/src/utils/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, { key: "mes:envios:patch", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MES");
  if (forbidden) return jsonForbidden();

  const { id } = await params;
  const envioId = String(id ?? "").trim();
  if (!envioId) {
    return jsonError(400, "VALIDATION_ERROR", "El envío es obligatorio.", {
      id: ["Debes indicar el envío a actualizar."],
    });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo de la solicitud no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = mesEnvioUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Los datos de actualización son inválidos.");
  }

  const payload = parsed.data;
  const status = payload.status;

  try {
    const [envio] = await mesDb
      .select({
        id: mesShipments.id,
        orderId: mesShipments.orderId,
        origenArea: mesShipments.origenArea,
        destinoArea: mesShipments.destinoArea,
        status: mesShipments.status,
        dispatchApprovals: mesShipments.dispatchApprovals,
      })
      .from(mesShipments)
      .where(eq(mesShipments.id, envioId))
      .limit(1);

    if (!envio) {
      return jsonNotFound("El envío indicado no existe.");
    }

    if (!isValidEnvioStatusTransition(String(envio.status ?? ""), status)) {
      return jsonError(
        409,
        "INVALID_STATUS_TRANSITION",
        "La transición de estado del envío no es válida.",
        {
          status: [
            `No puedes pasar de ${String(envio.status ?? "-")} a ${status}.`,
          ],
        },
      );
    }

    if (
      isDispatchShipment({
        origenArea: String(envio.origenArea ?? ""),
        destinoArea: String(envio.destinoArea ?? ""),
      }) &&
      (status === "EN_RUTA" || status === "ENTREGADO")
    ) {
      const [prefacturaRow] = await erpDb
        .select({
          accountingStatus: preInvoices.status,
          advanceReceived: preInvoices.advanceReceived,
          advanceStatus: preInvoices.advanceStatus,
        })
        .from(preInvoices)
        .where(eq(preInvoices.orderId, envio.orderId))
        .limit(1);

      const [shipmentItemsCount] = await mesDb
        .select({ totalItems: sql<number>`count(*)::int` })
        .from(mesShipmentItems)
        .where(eq(mesShipmentItems.envioId, envioId));

      const [orderItemsCount] = await erpDb
        .select({ totalItems: sql<number>`count(*)::int` })
        .from(orderItems)
        .where(eq(orderItems.orderId, envio.orderId));

      const selectedItems = await mesDb
        .select({ orderItemId: mesShipmentItems.orderItemId })
        .from(mesShipmentItems)
        .where(eq(mesShipmentItems.envioId, envioId));
      const selectedIds = selectedItems
        .map((row) => String(row.orderItemId ?? "").trim())
        .filter(Boolean);

      const partialApprovalRows = selectedIds.length
        ? await mesDb
            .select({ id: mesItemTags.id })
            .from(mesItemTags)
            .where(
              sql`${mesItemTags.orderId} = ${envio.orderId} and ${mesItemTags.tag} = 'DESPACHO_PARCIAL' and ${mesItemTags.orderItemId} in ${selectedIds}`,
            )
            .limit(1)
        : [];

      const [legalStatusRow] = await erpDb
        .select({ isLegallyEnabled: clientLegalStatus.isLegallyEnabled })
        .from(clientLegalStatus)
        .where(
          sql`${clientLegalStatus.clientId} = (
            select o.client_id from orders o where o.id = ${envio.orderId}
          )`,
        )
        .limit(1);

      const dispatchApprovals = normalizeDispatchApprovals(
        (payload.dispatchApprovals as any) ?? (envio.dispatchApprovals as any) ?? undefined,
      );

      const blockingRule = getDispatchBlockingRule({
        legalEnabled: legalStatusRow?.isLegallyEnabled ?? true,
        sellerApproved: Boolean(dispatchApprovals?.seller.approved),
        carteraApproved: Boolean(dispatchApprovals?.cartera.approved),
        accountingApproved:
          hasAccountingApproval({
            accountingStatus: prefacturaRow?.accountingStatus ?? null,
            advanceReceived: prefacturaRow?.advanceReceived ?? null,
            advanceStatus: prefacturaRow?.advanceStatus ?? null,
          }) && Boolean(dispatchApprovals?.accounting.approved),
        isPartialDispatch:
          Number(orderItemsCount?.totalItems ?? 0) >
          Number(shipmentItemsCount?.totalItems ?? 0),
        partialDispatchApproved:
          partialApprovalRows.length > 0 ||
          Number(orderItemsCount?.totalItems ?? 0) <=
            Number(shipmentItemsCount?.totalItems ?? 0) ||
          Boolean(dispatchApprovals?.partial?.approved),
      });

      if (blockingRule) {
        return jsonError(
          blockingRule.status,
          blockingRule.code,
          blockingRule.message,
          blockingRule.fieldErrors,
        );
      }
    }

    const update: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (status === "EN_RUTA" && !payload.salidaAt) update.salidaAt = new Date();
    if (payload.salidaAt) {
      const salidaAt = toValidDate(payload.salidaAt);

      if (!salidaAt) {
        return jsonError(
          400,
          "VALIDATION_ERROR",
          "La fecha de salida no es válida.",
          { salidaAt: ["Ingresa una fecha de salida válida."] },
        );
      }

      update.salidaAt = salidaAt;
    }
    if (payload.llegadaAt) {
      const llegadaAt = toValidDate(payload.llegadaAt);

      if (!llegadaAt) {
        return jsonError(
          400,
          "VALIDATION_ERROR",
          "La fecha de llegada no es válida.",
          { llegadaAt: ["Ingresa una fecha de llegada válida."] },
        );
      }

      update.llegadaAt = llegadaAt;
    }
    if (payload.retornoAt) {
      const retornoAt = toValidDate(payload.retornoAt);

      if (!retornoAt) {
        return jsonError(
          400,
          "VALIDATION_ERROR",
          "La fecha de retorno no es válida.",
          { retornoAt: ["Ingresa una fecha de retorno válida."] },
        );
      }

      update.retornoAt = retornoAt;
    }
    if (status === "ENTREGADO" && !payload.llegadaAt) update.llegadaAt = new Date();
    if (status === "RETORNADO" && !payload.retornoAt) update.retornoAt = new Date();
    if (payload.observaciones !== undefined)
      update.observaciones = String(payload.observaciones ?? "").trim() || null;
    if (payload.evidenciaUrl !== undefined)
      update.evidenciaUrl = String(payload.evidenciaUrl ?? "").trim() || null;
    if (payload.dispatchApprovals !== undefined)
      update.dispatchApprovals = normalizeDispatchApprovals(payload.dispatchApprovals);

    await mesDb
      .update(mesShipments)
      .set(update as any)
      .where(eq(mesShipments.id, envioId));

    return new Response(null, { status: 204 });
  } catch (error) {
    const resp = dbJsonError(error, "No se pudo actualizar el envío.");

    if (resp) return resp;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo actualizar el envío.");
  }
}
