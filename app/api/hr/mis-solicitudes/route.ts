import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employeeLeaves, employees } from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function resolveEmployeeId(request: Request): Promise<string | null> {
  const direct = getEmployeeIdFromRequest(request);

  if (direct) return direct;

  // Fallback: lookup by userId
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
    key: "mis-solicitudes:get",
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

    const where = eq(employeeLeaves.employeeId, employeeId);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeeLeaves)
      .where(where);

    const total = countRow?.count ?? 0;

    const items = await db
      .select({
        id: employeeLeaves.id,
        leaveType: employeeLeaves.leaveType,
        startDate: employeeLeaves.startDate,
        endDate: employeeLeaves.endDate,
        durationDays: sql<number>`(${employeeLeaves.endDate}::date - ${employeeLeaves.startDate}::date + 1)::int`,
        hoursAbsent: employeeLeaves.hoursAbsent,
        payrollDeduction: employeeLeaves.payrollDeduction,
        notes: employeeLeaves.notes,
        approvedBy: employeeLeaves.approvedBy,
        approvedByName: sql<string>`(select e2.name from employees e2 where e2.id = ${employeeLeaves.approvedBy} limit 1)`,
        createdAt: employeeLeaves.createdAt,
      })
      .from(employeeLeaves)
      .where(where)
      .orderBy(desc(employeeLeaves.startDate), desc(employeeLeaves.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [employeeRow] = await db
      .select({
        id: employees.id,
        name: employees.name,
        employeeCode: employees.employeeCode,
      })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.isActive, true)))
      .limit(1);

    return Response.json({
      employee: employeeRow ?? null,
      items,
      page,
      pageSize,
      total,
      hasNextPage: offset + pageSize < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar las solicitudes", {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "mis-solicitudes:post",
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

    const startDate = String(body?.startDate ?? "").trim();
    const endDate = String(body?.endDate ?? "").trim();
    const notes = String(body?.notes ?? "").trim();
    // Solicitudes de empleado siempre son tipo PAID (vacaciones remuneradas)
    const leaveType = "PAID" as const;

    if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
      return new Response("Fechas inválidas (formato esperado: YYYY-MM-DD)", {
        status: 400,
      });
    }

    if (startDate > endDate) {
      return new Response("La fecha final no puede ser menor que la inicial", {
        status: 400,
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    if (startDate < today) {
      return new Response("La fecha de inicio no puede ser en el pasado", {
        status: 400,
      });
    }

    const [employeeExists] = await db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.isActive, true)))
      .limit(1);

    if (!employeeExists) {
      return new Response("Empleado no encontrado o inactivo", { status: 404 });
    }

    const [overlap] = await db
      .select({ id: employeeLeaves.id })
      .from(employeeLeaves)
      .where(
        and(
          eq(employeeLeaves.employeeId, employeeId),
          sql`${employeeLeaves.startDate}::date <= ${endDate}::date and ${employeeLeaves.endDate}::date >= ${startDate}::date`,
        ),
      )
      .limit(1);

    if (overlap) {
      return new Response(
        "Ya tienes una solicitud registrada que se cruza con ese rango de fechas",
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(employeeLeaves)
      .values({
        employeeId,
        leaveType,
        startDate,
        endDate,
        payrollDeduction: false,
        notes: notes || null,
        approvedBy: null,
      })
      .returning({ id: employeeLeaves.id });

    return Response.json(
      { id: created?.id ?? null, ok: true },
      { status: 201 },
    );
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo registrar la solicitud", { status: 500 });
  }
}
