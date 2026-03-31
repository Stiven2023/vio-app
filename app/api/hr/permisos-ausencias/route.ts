import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employeeLeaves, employees } from "@/src/db/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

type LeaveTypeFilter = "ALL" | "PAID" | "UNPAID";
type PayrollDeductionFilter = "ALL" | "YES" | "NO";

const VALID_LEAVE_TYPES = new Set<LeaveTypeFilter>(["PAID", "UNPAID"]);
const VALID_PAYROLL_FILTERS = new Set<PayrollDeductionFilter>(["YES", "NO"]);

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeMonth(value: string) {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;

  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");

  return `${today.getFullYear()}-${month}`;
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseBooleanOrNull(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;

  return null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "employee-leaves:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PERMISOS_EMPLEADO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const employeeId = String(searchParams.get("employeeId") ?? "").trim();

    const rawLeaveType = String(searchParams.get("leaveType") ?? "ALL")
      .trim()
      .toUpperCase();
    const leaveType: LeaveTypeFilter = VALID_LEAVE_TYPES.has(
      rawLeaveType as LeaveTypeFilter,
    )
      ? (rawLeaveType as LeaveTypeFilter)
      : "ALL";

    const dateFrom = String(searchParams.get("dateFrom") ?? "").trim();
    const dateTo = String(searchParams.get("dateTo") ?? "").trim();

    const rawDeduction = String(searchParams.get("payrollDeduction") ?? "ALL")
      .trim()
      .toUpperCase();
    const payrollDeduction: PayrollDeductionFilter = VALID_PAYROLL_FILTERS.has(
      rawDeduction as PayrollDeductionFilter,
    )
      ? (rawDeduction as PayrollDeductionFilter)
      : "ALL";

    const summaryPeriod = normalizeMonth(
      String(searchParams.get("summaryPeriod") ?? "").trim(),
    );

    const clauses = [] as Array<
      | ReturnType<typeof eq>
      | ReturnType<typeof gte>
      | ReturnType<typeof lte>
      | ReturnType<typeof sql>
    >;

    if (employeeId) clauses.push(eq(employeeLeaves.employeeId, employeeId));
    if (leaveType !== "ALL") {
      clauses.push(eq(employeeLeaves.leaveType, leaveType));
    }
    if (isIsoDate(dateFrom))
      clauses.push(gte(employeeLeaves.startDate, dateFrom));
    if (isIsoDate(dateTo)) clauses.push(lte(employeeLeaves.endDate, dateTo));
    if (payrollDeduction === "YES") {
      clauses.push(eq(employeeLeaves.payrollDeduction, true));
    }
    if (payrollDeduction === "NO") {
      clauses.push(eq(employeeLeaves.payrollDeduction, false));
    }

    const where = clauses.length ? and(...clauses) : undefined;

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeeLeaves)
      .leftJoin(employees, eq(employeeLeaves.employeeId, employees.id))
      .where(where);

    const total = countRow?.count ?? 0;

    const items = await db
      .select({
        id: employeeLeaves.id,
        employeeId: employeeLeaves.employeeId,
        employeeName: employees.name,
        employeeCode: employees.employeeCode,
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
      .leftJoin(employees, eq(employeeLeaves.employeeId, employees.id))
      .where(where)
      .orderBy(desc(employeeLeaves.startDate), desc(employeeLeaves.createdAt))
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

    const monthlySummary = await db
      .select({
        employeeId: employeeLeaves.employeeId,
        employeeName: employees.name,
        totalLeaves: sql<number>`count(*)::int`,
        totalDays: sql<number>`coalesce(sum((${employeeLeaves.endDate}::date - ${employeeLeaves.startDate}::date + 1)), 0)::int`,
        unpaidDays: sql<number>`coalesce(sum(case when ${employeeLeaves.leaveType} = 'UNPAID' then (${employeeLeaves.endDate}::date - ${employeeLeaves.startDate}::date + 1) else 0 end), 0)::int`,
        payrollDeductions: sql<number>`coalesce(sum(case when ${employeeLeaves.payrollDeduction} = true then 1 else 0 end), 0)::int`,
      })
      .from(employeeLeaves)
      .leftJoin(employees, eq(employeeLeaves.employeeId, employees.id))
      .where(
        and(
          sql`to_char(${employeeLeaves.startDate}::date, 'YYYY-MM') = ${summaryPeriod}`,
          eq(employees.isActive, true),
        ),
      )
      .groupBy(employeeLeaves.employeeId, employees.name)
      .orderBy(asc(employees.name));

    return Response.json({
      items,
      employeeOptions,
      monthlySummary,
      summaryPeriod,
      page,
      pageSize,
      total,
      hasNextPage: offset + pageSize < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar permisos y ausencias", {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "employee-leaves:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "APROBAR_PERMISO_EMPLEADO",
  );

  if (forbidden) return forbidden;

  try {
    const body = await request.json();

    const employeeId = String(body?.employeeId ?? "").trim();
    const leaveType = String(body?.leaveType ?? "")
      .trim()
      .toUpperCase() as "PAID" | "UNPAID";
    const startDate = String(body?.startDate ?? "").trim();
    const endDate = String(body?.endDate ?? "").trim();
    const notes = String(body?.notes ?? "").trim();
    const hoursAbsent = toNumberOrNull(body?.hoursAbsent);

    const deductionFromBody = parseBooleanOrNull(body?.payrollDeduction);
    const payrollDeduction =
      deductionFromBody !== null ? deductionFromBody : leaveType === "UNPAID";

    if (!employeeId) {
      return new Response("Empleado requerido", { status: 400 });
    }

    if (!(leaveType === "PAID" || leaveType === "UNPAID")) {
      return new Response("Tipo de permiso inválido", { status: 400 });
    }

    if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
      return new Response("Fechas inválidas", { status: 400 });
    }

    if (startDate > endDate) {
      return new Response("La fecha final no puede ser menor que la inicial", {
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

    const approvedBy = getEmployeeIdFromRequest(request);

    const [created] = await db
      .insert(employeeLeaves)
      .values({
        employeeId,
        leaveType,
        startDate,
        endDate,
        hoursAbsent: hoursAbsent !== null ? hoursAbsent.toFixed(2) : null,
        payrollDeduction,
        notes: notes || null,
        approvedBy,
      })
      .returning({ id: employeeLeaves.id });

    const leaveTypeLabel = leaveType === "PAID" ? "remunerado" : "no remunerado";

    void createNotificationsForPermission("VER_PERMISOS_EMPLEADO", {
      title: "Permiso/ausencia registrado",
      message: `Se registró un permiso ${leaveTypeLabel} para el empleado ${employeeExists.name ?? employeeId} (${startDate} – ${endDate}).`,
      href: `/erp/hcm/permisos-ausencias`,
    });

    return Response.json(
      { id: created?.id ?? null, ok: true },
      { status: 201 },
    );
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo registrar el permiso", { status: 500 });
  }
}
