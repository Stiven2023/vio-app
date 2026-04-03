import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employeeRequests, employees } from "@/src/db/erp/schema";
import {
  getEmployeeIdFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { normalizePermissionHours } from "@/src/utils/business-rule-guards";
import { createPetitionSchema } from "@/src/schemas/hcm";
import { zodFirstErrorResponse } from "@/src/utils/zod-response";

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

    const parsed = createPetitionSchema.safeParse(body);

    if (!parsed.success) return zodFirstErrorResponse(parsed.error);

    const { type, subject, description, requestDate, requestHours: requestHoursRaw, priority: resolvedPriority } = parsed.data;

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
        type,
        subject,
        description,
        requestDate: requestDate ?? null,
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
