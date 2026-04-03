import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employeeRequests, employees } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

const VALID_STATUSES = new Set(["PENDIENTE", "APROBADO", "RECHAZADO", "EN_REVISION", "CERRADO"]);
const VALID_TYPES = new Set(["PERMISO", "RECLAMO", "SOLICITUD", "SUGERENCIA", "PQR"]);

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "hr-peticiones:get",
    limit: 100,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PERMISOS_EMPLEADO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const employeeId = String(searchParams.get("employeeId") ?? "").trim();
    const rawStatus = String(searchParams.get("status") ?? "").trim().toUpperCase();
    const rawType = String(searchParams.get("type") ?? "").trim().toUpperCase();
    const dateFrom = String(searchParams.get("dateFrom") ?? "").trim();
    const dateTo = String(searchParams.get("dateTo") ?? "").trim();

    const clauses = [];

    if (employeeId) clauses.push(eq(employeeRequests.employeeId, employeeId));
    if (VALID_STATUSES.has(rawStatus)) {
      clauses.push(eq(employeeRequests.status, rawStatus as any));
    }
    if (VALID_TYPES.has(rawType)) {
      clauses.push(eq(employeeRequests.type, rawType as any));
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      clauses.push(sql`${employeeRequests.createdAt}::date >= ${dateFrom}::date`);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      clauses.push(sql`${employeeRequests.createdAt}::date <= ${dateTo}::date`);
    }

    const where = clauses.length ? and(...clauses) : undefined;

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeeRequests)
      .leftJoin(employees, eq(employeeRequests.employeeId, employees.id))
      .where(where);

    const total = countRow?.count ?? 0;

    const items = await db
      .select({
        id: employeeRequests.id,
        employeeId: employeeRequests.employeeId,
        employeeName: employees.name,
        employeeCode: employees.employeeCode,
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
      .leftJoin(employees, eq(employeeRequests.employeeId, employees.id))
      .where(where)
      .orderBy(desc(employeeRequests.createdAt))
      .limit(pageSize)
      .offset(offset);

    const employeeOptions = await db
      .select({
        id: employees.id,
        name: employees.name,
        employeeCode: employees.employeeCode,
      })
      .from(employees)
      .where(eq(employees.isActive, true))
      .orderBy(asc(employees.name));

    return Response.json({
      items,
      employeeOptions,
      page,
      pageSize,
      total,
      hasNextPage: offset + pageSize < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar las peticiones", { status: 500 });
  }
}
