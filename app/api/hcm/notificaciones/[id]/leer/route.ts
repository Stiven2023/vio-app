import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { notificacionesHcm } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { resolveEmployeeIdFromRequest } from "@/src/utils/employee-session";
import { hcmNotificacionParamsSchema } from "@/src/utils/hcm-contract";
import { rateLimit } from "@/src/utils/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "hcm:notificaciones:leer:patch",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const employeeId = await resolveEmployeeIdFromRequest(request);

  if (!employeeId) {
    return jsonError(
      401,
      "UNAUTHORIZED",
      "No autenticado o sin perfil de empleado.",
    );
  }

  const parsedParams = hcmNotificacionParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return zodFirstErrorEnvelope(
      parsedParams.error,
      "Parámetros de notificación inválidos.",
    );
  }

  try {
    const [updated] = await db
      .update(notificacionesHcm)
      .set({ leida: true })
      .where(
        and(
          eq(notificacionesHcm.id, parsedParams.data.id),
          eq(notificacionesHcm.employeeId, employeeId),
        ),
      )
      .returning({
        id: notificacionesHcm.id,
        leida: notificacionesHcm.leida,
      });

    if (!updated) {
      return jsonError(404, "NOT_FOUND", "Notificación no encontrada.");
    }

    return Response.json(updated);
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudo marcar la notificación como leída.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo marcar la notificación como leída.",
    );
  }
}
