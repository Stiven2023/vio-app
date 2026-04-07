import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { solicitudesHorasExtras } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { resolveEmployeeIdFromRequest } from "@/src/utils/employee-session";
import {
  hcmHorasExtrasListQuerySchema,
  hcmSolicitudHoraExtraSchema,
} from "@/src/utils/hcm-contract";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { crearSolicitudHoraExtra } from "@/src/hcm/services/hcm.service";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "hcm:horas-extras:get",
    limit: 120,
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
  const query = hcmHorasExtrasListQuerySchema.safeParse({
    period: searchParams.get("period") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    fecha: searchParams.get("fecha") ?? undefined,
  });

  if (!query.success) {
    return zodFirstErrorEnvelope(
      query.error,
      "Parámetros de horas extras inválidos.",
    );
  }

  const { page, pageSize, offset } = parsePagination(searchParams);
  const clauses = [eq(solicitudesHorasExtras.employeeId, employeeId)];

  if (query.data.period)
    clauses.push(eq(solicitudesHorasExtras.period, query.data.period));
  if (query.data.status)
    clauses.push(eq(solicitudesHorasExtras.status, query.data.status));
  if (query.data.fecha)
    clauses.push(eq(solicitudesHorasExtras.fecha, query.data.fecha));

  const where = and(...clauses);

  try {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(solicitudesHorasExtras)
      .where(where);

    const total = countRow?.count ?? 0;

    const items = await db
      .select({
        id: solicitudesHorasExtras.id,
        supervisorId: solicitudesHorasExtras.supervisorId,
        fecha: solicitudesHorasExtras.fecha,
        horaInicio: solicitudesHorasExtras.horaInicio,
        horaFin: solicitudesHorasExtras.horaFin,
        tipo: solicitudesHorasExtras.tipo,
        totalHoras: solicitudesHorasExtras.totalHoras,
        actividad: solicitudesHorasExtras.actividad,
        status: solicitudesHorasExtras.status,
        valorCalculado: solicitudesHorasExtras.valorCalculado,
        period: solicitudesHorasExtras.period,
        aprobadoEn: solicitudesHorasExtras.aprobadoEn,
        motivoRechazo: solicitudesHorasExtras.motivoRechazo,
        createdAt: solicitudesHorasExtras.createdAt,
      })
      .from(solicitudesHorasExtras)
      .where(where)
      .orderBy(desc(solicitudesHorasExtras.createdAt))
      .limit(pageSize)
      .offset(offset);

    return Response.json({
      items,
      page,
      pageSize,
      total,
      hasNextPage: offset + items.length < total,
    });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudieron consultar las horas extras.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudieron consultar las horas extras.",
    );
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "hcm:horas-extras:post",
    limit: 40,
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

  const body = (await request.json().catch(() => null)) as unknown;

  if (!body || typeof body !== "object") {
    return jsonError(400, "INVALID_JSON", "El cuerpo JSON es inválido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = hcmSolicitudHoraExtraSchema.safeParse({
    ...(body as Record<string, unknown>),
    employeeId,
  });

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "La solicitud de horas extras es inválida.",
    );
  }

  try {
    const created = await crearSolicitudHoraExtra(parsed.data);

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudo crear la solicitud de horas extras.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo crear la solicitud de horas extras.",
    );
  }
}
