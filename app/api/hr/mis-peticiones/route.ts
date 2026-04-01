import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employeeRequests, employees } from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import {
  isPermissionHoursValid,
  normalizePermissionHours,
} from "@/src/utils/business-rule-guards";

const VALID_TYPES = new Set([
  "PERMISO",
  "RECLAMO",
  "SOLICITUD",
  "SUGERENCIA",
  "PQR",
]);
const VALID_PRIORITIES = new Set(["BAJA", "MEDIA", "ALTA"]);

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function resolveEmployeeId(request: Request): Promise<string | null> {
  const direct = getEmployeeIdFromRequest(request);

  if (direct) return direct;

  const userId = getUserIdFromRequest(request);

  if (!userId) return null;

  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  return row?.id ?? null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "mis-peticiones:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const employeeId = await resolveEmployeeId(request);

  if (!employeeId) {
    return new Response("No autenticado o sin perfil de empleado", {
      status: 401,
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const where = eq(employeeRequests.employeeId, employeeId);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeeRequests)
      .where(where);

    const total = countRow?.count ?? 0;

    const items = await db
      .select({
        id: employeeRequests.id,
        type: employeeRequests.type,
        subject: employeeRequests.subject,
        description: employeeRequests.description,
        requestDate: employeeRequests.requestDate,
        requestHours: employeeRequests.requestHours,
        priority: employeeRequests.priority,
        status: employeeRequests.status,
        responseNotes: employeeRequests.responseNotes,
        resolvedByName: sql<string>`(select e2.name from employees e2 where e2.id = ${employeeRequests.resolvedBy} limit 1)`,
        resolvedAt: employeeRequests.resolvedAt,
        createdAt: employeeRequests.createdAt,
      })
      .from(employeeRequests)
      .where(where)
      .orderBy(desc(employeeRequests.createdAt))
      .limit(pageSize)
      .offset(offset);

    return Response.json({
      items,
      page,
      pageSize,
      total,
      hasNextPage: offset + pageSize < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar las peticiones", {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "mis-peticiones:post",
    limit: 10,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const employeeId = await resolveEmployeeId(request);

  if (!employeeId) {
    return new Response("No autenticado o sin perfil de empleado", {
      status: 401,
    });
  }

  try {
    const body = await request.json();

    const type = String(body?.type ?? "").trim().toUpperCase();
    const subject = String(body?.subject ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const requestDate = String(body?.requestDate ?? "").trim();
    const requestHoursRaw = body?.requestHours;
    const priority = String(body?.priority ?? "MEDIA").trim().toUpperCase();

    if (!VALID_TYPES.has(type)) {
      return new Response("Tipo de petición inválido", { status: 400 });
    }

    if (!subject) {
      return new Response("El asunto es requerido", { status: 400 });
    }

    if (!description) {
      return new Response("La descripción es requerida", { status: 400 });
    }

    if (type === "PERMISO") {
      if (!isIsoDate(requestDate)) {
        return new Response(
          "Para permisos, la fecha es requerida (formato YYYY-MM-DD)",
          { status: 400 },
        );
      }
    }

    const resolvedPriority = VALID_PRIORITIES.has(priority)
      ? (priority as "BAJA" | "MEDIA" | "ALTA")
      : ("MEDIA" as const);

    const requestHours =
      requestHoursRaw !== undefined &&
      requestHoursRaw !== null &&
      requestHoursRaw !== ""
        ? Number(requestHoursRaw)
        : null;

    if (type === "PERMISO" && requestHours !== null) {
      if (!isPermissionHoursValid(requestHours)) {
        return new Response(
          "Las horas del permiso deben estar entre 0.5 y 24",
          { status: 400 },
        );
      }
    }

    const normalizedRequestHours = normalizePermissionHours(
      type,
      requestHoursRaw,
    );

    const [employeeExists] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.isActive, true)))
      .limit(1);

    if (!employeeExists) {
      return new Response("Empleado no encontrado o inactivo", { status: 404 });
    }

    const [created] = await db
      .insert(employeeRequests)
      .values({
        employeeId,
        type: type as "PERMISO" | "RECLAMO" | "SOLICITUD" | "SUGERENCIA" | "PQR",
        subject,
        description,
        requestDate: isIsoDate(requestDate) ? requestDate : null,
        requestHours: normalizedRequestHours,
        priority: resolvedPriority,
        status: "PENDIENTE",
      })
      .returning({ id: employeeRequests.id });

    return Response.json(
      { id: created?.id ?? null, ok: true },
      { status: 201 },
    );
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo registrar la petición", { status: 500 });
  }
}
