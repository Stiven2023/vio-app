import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { notifications } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { notificationParamsSchema } from "@/src/utils/notifications-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "notifications:patch-one",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_NOTIFICACION");

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para ver notificaciones.");
  }

  const role = getRoleFromRequest(request);

  if (!role) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para ver notificaciones.");
  }

  const parsedParams = notificationParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return zodFirstErrorEnvelope(
      parsedParams.error,
      "Parámetros de notificación inválidos.",
    );
  }

  const nid = parsedParams.data.id;

  try {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, nid), eq(notifications.role, role)))
      .returning({ id: notifications.id });

    if (!updated) {
      return jsonError(404, "NOT_FOUND", "Notificación no encontrada.");
    }

    return Response.json(updated);
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudo actualizar la notificación.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo actualizar la notificación.",
    );
  }
}
