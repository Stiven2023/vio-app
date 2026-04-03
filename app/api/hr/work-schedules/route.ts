import { asc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employees } from "@/src/db/erp/schema";
import { buildMonthSchedule, normalizeMonth } from "@/src/utils/work-schedule";
import { requirePermission } from "@/src/utils/permission-middleware";

export async function GET(request: Request) {
  const forbidden = await requirePermission(request, "VER_PERMISOS_EMPLEADO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const month = normalizeMonth(searchParams.get("month"));

  const rows = await db
    .select({
      id: employees.id,
      name: employees.name,
      employeeCode: employees.employeeCode,
      contractType: employees.contractType,
    })
    .from(employees)
    .where(eq(employees.isActive, true))
    .orderBy(asc(employees.name));

  const schedules = rows.map((employee) => buildMonthSchedule(employee, month));

  return Response.json({ month, schedules });
}
