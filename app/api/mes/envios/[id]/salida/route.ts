/**
 * POST /api/mes/envios/[id]/salida
 * Registra la salida física de un envío: marca salidaAt, datos de logística,
 * operador, dirección destino y si requiere valor declarado.
 * Transiciona el estado de CREADO → EN_RUTA.
 */
import { and, eq } from "drizzle-orm";

import { mesDb } from "@/src/db";
import { mesShipments } from "@/src/db/mes/schema";
import {
  dbJsonError,
  jsonError,
  jsonForbidden,
  jsonNotFound,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { mesEnvioSalidaSchema, toValidDate } from "@/src/utils/mes-workflow";

function toStr(v: unknown) {
  return String(v ?? "").trim() || null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "mes:envios:salida:post",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "GESTIONAR_MES");
  if (forbidden) return jsonForbidden();

  const { id } = await params;
  if (!id) return jsonNotFound("Envío no encontrado.");

  const body = await request.json().catch(() => null);
  const parsed = mesEnvioSalidaSchema.safeParse(body);
  if (!parsed.success) return zodFirstErrorEnvelope(parsed.error);

  const data = parsed.data;

  const existing = await mesDb
    .select({ id: mesShipments.id, status: mesShipments.status })
    .from(mesShipments)
    .where(eq(mesShipments.id, id))
    .limit(1);

  if (!existing.length) return jsonNotFound("Envío no encontrado.");

  const current = existing[0];

  if (current.status !== "CREADO") {
    return jsonError(422, "INVALID_STATE_FOR_SALIDA", "Solo se puede registrar salida desde estado CREADO.", {
      status: [`Estado actual: ${current.status}`],
    });
  }

  const salidaAt = toValidDate(data.salidaAt);
  if (!salidaAt) {
    return jsonError(400, "VALIDATION_ERROR", "La fecha de salida es inválida.", {
      salidaAt: ["Formato de fecha no reconocido."],
    });
  }

  const updateResult = await mesDb
    .update(mesShipments)
    .set({
      status: "EN_RUTA",
      salidaAt,
      logisticOperator: toStr(data.logisticOperator),
      destinationAddress: toStr(data.destinationAddress),
      requiresDeclaredValue: data.requiresDeclaredValue ?? false,
      courierBroughtBy: toStr(data.courierBroughtBy),
      observaciones: toStr(data.observaciones),
      updatedAt: new Date(),
    })
    .where(and(eq(mesShipments.id, id), eq(mesShipments.status, "CREADO")))
    .returning({
      id: mesShipments.id,
      status: mesShipments.status,
      salidaAt: mesShipments.salidaAt,
    })
    .catch((e) => dbJsonError(e, "No se pudo registrar la salida."));

  if (updateResult instanceof Response) return updateResult;
  const updated = updateResult?.[0];
  if (!updated) {
    return jsonError(409, "CONCURRENT_UPDATE", "El estado del envío cambió. Recarga e intenta de nuevo.", {});
  }

  return Response.json({ ok: true, data: updated }, { status: 200 });
}
