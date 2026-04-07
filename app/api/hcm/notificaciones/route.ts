import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { notificacionesHcm } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { resolveEmployeeIdFromRequest } from "@/src/utils/employee-session";
import { hcmNotificacionesQuerySchema } from "@/src/utils/hcm-contract";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "hcm:notificaciones:get",
    limit: 150,
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

  const { searchParams } = new URL(request.url);
  const query = hcmNotificacionesQuerySchema.safeParse({
    leida: searchParams.get("leida") ?? undefined,
  });

  if (!query.success) {
    return zodFirstErrorEnvelope(
      query.error,
      "Parámetros de notificaciones HCM inválidos.",
    );
  }

  const { page, pageSize, offset } = parsePagination(searchParams);
  const clauses = [eq(notificacionesHcm.employeeId, employeeId)];

  if (query.data.leida) {
    clauses.push(eq(notificacionesHcm.leida, query.data.leida === "true"));
  }

  const where = and(...clauses);

  try {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificacionesHcm)
      .where(where);

    const total = countRow?.count ?? 0;

    const items = await db
      .select({
        id: notificacionesHcm.id,
        titulo: notificacionesHcm.titulo,
        mensaje: notificacionesHcm.mensaje,
        tipo: notificacionesHcm.tipo,
        leida: notificacionesHcm.leida,
        accionUrl: notificacionesHcm.accionUrl,
        creadaEn: notificacionesHcm.creadaEn,
      })
      .from(notificacionesHcm)
      .where(where)
      .orderBy(desc(notificacionesHcm.creadaEn))
      .limit(pageSize)
      .offset(offset);

    const [unreadRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificacionesHcm)
      .where(
        and(
          eq(notificacionesHcm.employeeId, employeeId),
          eq(notificacionesHcm.leida, false),
        ),
      );

    return Response.json({
      items,
      page,
      pageSize,
      total,
      hasNextPage: offset + items.length < total,
      unreadCount: unreadRow?.count ?? 0,
    });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudieron consultar las notificaciones HCM.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudieron consultar las notificaciones HCM.",
    );
  }
}
