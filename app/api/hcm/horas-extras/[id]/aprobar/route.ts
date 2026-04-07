import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { solicitudesHorasExtras } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  jsonForbidden,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { resolveEmployeeIdFromRequest } from "@/src/utils/employee-session";
import {
  hcmHoraExtraAprobarBodySchema,
  hcmHoraExtraAprobarParamsSchema,
} from "@/src/utils/hcm-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "hcm:horas-extras:aprobar:patch",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "APROBAR_HORAS_EXTRAS_HCM",
  );

  if (forbidden) return jsonForbidden();

  const parsedParams = hcmHoraExtraAprobarParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return zodFirstErrorEnvelope(
      parsedParams.error,
      "Parámetros de aprobación inválidos.",
    );
  }

  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsedBody = hcmHoraExtraAprobarBodySchema.safeParse(body);

  if (!parsedBody.success) {
    return zodFirstErrorEnvelope(
      parsedBody.error,
      "Datos de aprobación inválidos.",
    );
  }

  const approverId = await resolveEmployeeIdFromRequest(request);

  try {
    const [row] = await db
      .select({
        id: solicitudesHorasExtras.id,
        status: solicitudesHorasExtras.status,
      })
      .from(solicitudesHorasExtras)
      .where(eq(solicitudesHorasExtras.id, parsedParams.data.id))
      .limit(1);

    if (!row) {
      return jsonError(
        404,
        "NOT_FOUND",
        "Solicitud de horas extras no encontrada.",
      );
    }

    if (row.status !== "PENDIENTE") {
      return jsonError(
        409,
        "HCM_HORA_EXTRA_INVALID_STATUS",
        "Solo se pueden aprobar o rechazar solicitudes en estado PENDIENTE.",
        {
          status: ["Estado actual no permite transición."],
        },
      );
    }

    const now = new Date();
    const aprobar = parsedBody.data.aprobar;

    const [updated] = await db
      .update(solicitudesHorasExtras)
      .set({
        status: aprobar ? "APROBADO" : "RECHAZADO",
        aprobadoPor: aprobar ? approverId : null,
        aprobadoEn: aprobar ? now : null,
        rechazadoPor: aprobar ? null : approverId,
        motivoRechazo: aprobar
          ? null
          : parsedBody.data.motivoRechazo || "Rechazada por supervisor.",
        updatedAt: now,
      })
      .where(
        and(
          eq(solicitudesHorasExtras.id, parsedParams.data.id),
          eq(solicitudesHorasExtras.status, "PENDIENTE"),
        ),
      )
      .returning({
        id: solicitudesHorasExtras.id,
        status: solicitudesHorasExtras.status,
        aprobadoPor: solicitudesHorasExtras.aprobadoPor,
        aprobadoEn: solicitudesHorasExtras.aprobadoEn,
        rechazadoPor: solicitudesHorasExtras.rechazadoPor,
        motivoRechazo: solicitudesHorasExtras.motivoRechazo,
      });

    if (!updated) {
      return jsonError(
        409,
        "HCM_HORA_EXTRA_CONFLICT",
        "La solicitud cambió de estado antes de completar la operación.",
      );
    }

    return Response.json(updated);
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudo procesar la aprobación de horas extras.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo procesar la aprobación de horas extras.",
    );
  }
}
