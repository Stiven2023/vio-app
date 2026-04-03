import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employees } from "@/src/db/erp/schema";
import {
  getEmployeeIdFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import {
  buildMonthSchedule,
  buildWeekFromMonth,
  normalizeMonth,
} from "@/src/utils/work-schedule";

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
  const employeeId = await resolveEmployeeId(request);

  if (!employeeId) {
    return new Response("No autenticado o sin perfil de empleado", {
      status: 401,
    });
  }

  const { searchParams } = new URL(request.url);
  const month = normalizeMonth(searchParams.get("month"));
  const weekStart = String(searchParams.get("weekStart") ?? "").trim();

  const [employee] = await db
    .select({
      id: employees.id,
      name: employees.name,
      employeeCode: employees.employeeCode,
      contractType: employees.contractType,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) {
    return new Response("Empleado no encontrado", { status: 404 });
  }

  const monthSchedule = buildMonthSchedule(employee, month);
  const weekSchedule = buildWeekFromMonth(monthSchedule, weekStart);

  return Response.json({
    month,
    employee: {
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeCode,
      contractType: employee.contractType,
    },
    monthSchedule,
    weekSchedule,
  });
}
