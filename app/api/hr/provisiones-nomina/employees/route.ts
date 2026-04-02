import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, payrollProvisions } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "payroll-employees:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PROVISIONES_NOMINA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const period = String(searchParams.get("period") ?? "").trim();

    const activeEmployees = await db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        name: employees.name,
        contractType: employees.contractType,
      })
      .from(employees)
      .where(eq(employees.isActive, true))
      .orderBy(asc(employees.name));

    if (!period || activeEmployees.length === 0) {
      return Response.json({ employees: activeEmployees });
    }

    const employeeIds = activeEmployees.map((e) => e.id);

    const existingPeriod = await db
      .select({ employeeId: payrollProvisions.employeeId })
      .from(payrollProvisions)
      .where(
        sql`${payrollProvisions.period} = ${period} and ${payrollProvisions.employeeId} = any(${employeeIds}::uuid[])`,
      );

    const alreadyHasProvision = new Set(
      existingPeriod.map((r) => r.employeeId),
    );

    const latestByEmployee = await db
      .select({
        employeeId: payrollProvisions.employeeId,
        baseSalary: payrollProvisions.baseSalary,
        transportAllowance: payrollProvisions.transportAllowance,
        arlContribution: payrollProvisions.arlContribution,
        createdAt: payrollProvisions.createdAt,
      })
      .from(payrollProvisions)
      .where(sql`${payrollProvisions.employeeId} = any(${employeeIds}::uuid[])`)
      .orderBy(desc(payrollProvisions.createdAt));

    const latestMap = new Map<
      string,
      {
        baseSalary: string | null;
        transportAllowance: string | null;
        arlContribution: string | null;
      }
    >();

    for (const row of latestByEmployee) {
      if (!latestMap.has(row.employeeId)) {
        latestMap.set(row.employeeId, {
          baseSalary: row.baseSalary,
          transportAllowance: row.transportAllowance,
          arlContribution: row.arlContribution,
        });
      }
    }

    const enriched = activeEmployees.map((emp) => {
      const last = latestMap.get(emp.id);
      const lastSalary = Number(last?.baseSalary ?? 0);
      const lastArlContrib = Number(last?.arlContribution ?? 0);
      const impliedArlRate =
        lastSalary > 0 ? (lastArlContrib / lastSalary) * 100 : 0.522;

      return {
        ...emp,
        hasProvisionForPeriod: alreadyHasProvision.has(emp.id),
        lastBaseSalary: last?.baseSalary ?? null,
        lastTransportAllowance: last?.transportAllowance ?? null,
        lastArlRatePct: Number(impliedArlRate.toFixed(4)),
      };
    });

    return Response.json({ employees: enriched });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar empleados para provisiones", {
      status: 500,
    });
  }
}
