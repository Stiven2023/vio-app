import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, payrollProvisions } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

type ContractTypeFilter =
  | "ALL"
  | "FIXED_TERM"
  | "INDEFINITE_TERM"
  | "WORK_CONTRACT"
  | "SERVICE_CONTRACT";

const VALID_CONTRACT_TYPES = new Set<ContractTypeFilter>([
  "FIXED_TERM",
  "INDEFINITE_TERM",
  "WORK_CONTRACT",
  "SERVICE_CONTRACT",
]);

function toMoneyString(value: number) {
  return value.toFixed(2);
}

function parseMoney(value: unknown) {
  const n = Number(value);

  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function validatePeriod(value: unknown) {
  const text = String(value ?? "").trim();

  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "payroll-provisions:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PROVISIONES_NOMINA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const period = validatePeriod(searchParams.get("period"));
    const employeeId = String(searchParams.get("employeeId") ?? "").trim();
    const rawContract = String(searchParams.get("contractType") ?? "ALL")
      .trim()
      .toUpperCase();
    const contractType: ContractTypeFilter = VALID_CONTRACT_TYPES.has(
      rawContract as ContractTypeFilter,
    )
      ? (rawContract as ContractTypeFilter)
      : "ALL";

    const clauses = [] as ReturnType<typeof eq>[];

    if (period) clauses.push(eq(payrollProvisions.period, period));
    if (employeeId) clauses.push(eq(payrollProvisions.employeeId, employeeId));
    if (contractType !== "ALL") {
      clauses.push(
        eq(
          employees.contractType,
          contractType as
            | "FIXED_TERM"
            | "INDEFINITE_TERM"
            | "WORK_CONTRACT"
            | "SERVICE_CONTRACT",
        ),
      );
    }

    const where = clauses.length ? and(...clauses) : undefined;

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payrollProvisions)
      .leftJoin(employees, eq(payrollProvisions.employeeId, employees.id))
      .where(where);

    const total = countRow?.count ?? 0;

    const items = await db
      .select({
        id: payrollProvisions.id,
        period: payrollProvisions.period,
        employeeId: payrollProvisions.employeeId,
        employeeName: employees.name,
        employeeCode: employees.employeeCode,
        contractType: employees.contractType,
        baseSalary: payrollProvisions.baseSalary,
        transportAllowance: payrollProvisions.transportAllowance,
        severancePay: payrollProvisions.severancePay,
        severanceInterests: payrollProvisions.severanceInterests,
        serviceBonus: payrollProvisions.serviceBonus,
        vacationProvision: payrollProvisions.vacationProvision,
        healthContribution: payrollProvisions.healthContribution,
        pensionContribution: payrollProvisions.pensionContribution,
        arlContribution: payrollProvisions.arlContribution,
        compensationBoxContribution:
          payrollProvisions.compensationBoxContribution,
        createdAt: payrollProvisions.createdAt,
      })
      .from(payrollProvisions)
      .leftJoin(employees, eq(payrollProvisions.employeeId, employees.id))
      .where(where)
      .orderBy(desc(payrollProvisions.period), asc(employees.name))
      .limit(pageSize)
      .offset(offset);

    const employeeOptions = await db
      .selectDistinct({
        id: employees.id,
        name: employees.name,
        employeeCode: employees.employeeCode,
      })
      .from(payrollProvisions)
      .innerJoin(employees, eq(payrollProvisions.employeeId, employees.id))
      .orderBy(asc(employees.name));

    type SummaryRow = {
      totalSeverancePay: string;
      totalServiceBonus: string;
      totalVacationProvision: string;
      totalHealth: string;
      totalPension: string;
      totalArl: string;
      totalCompensation: string;
    };

    const [summaryRow] = await db
      .select({
        totalSeverancePay: sql<string>`coalesce(sum(${payrollProvisions.severancePay}), 0)::text`,
        totalServiceBonus: sql<string>`coalesce(sum(${payrollProvisions.serviceBonus}), 0)::text`,
        totalVacationProvision: sql<string>`coalesce(sum(${payrollProvisions.vacationProvision}), 0)::text`,
        totalHealth: sql<string>`coalesce(sum(${payrollProvisions.healthContribution}), 0)::text`,
        totalPension: sql<string>`coalesce(sum(${payrollProvisions.pensionContribution}), 0)::text`,
        totalArl: sql<string>`coalesce(sum(${payrollProvisions.arlContribution}), 0)::text`,
        totalCompensation: sql<string>`coalesce(sum(${payrollProvisions.compensationBoxContribution}), 0)::text`,
      })
      .from(payrollProvisions)
      .leftJoin(employees, eq(payrollProvisions.employeeId, employees.id))
      .where(where);

    const sr = summaryRow as SummaryRow | undefined;
    const totalSocialSecurity =
      parseMoney(sr?.totalHealth) +
      parseMoney(sr?.totalPension) +
      parseMoney(sr?.totalArl) +
      parseMoney(sr?.totalCompensation);

    const summary = {
      totalSeverancePay: toMoneyString(parseMoney(sr?.totalSeverancePay)),
      totalServiceBonus: toMoneyString(parseMoney(sr?.totalServiceBonus)),
      totalVacationProvision: toMoneyString(
        parseMoney(sr?.totalVacationProvision),
      ),
      totalSocialSecurity: toMoneyString(totalSocialSecurity),
    };

    return Response.json({
      items,
      employeeOptions,
      summary,
      page,
      pageSize,
      total,
      hasNextPage: offset + pageSize < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar provisiones de nómina", {
      status: 500,
    });
  }
}

type ProvisionInput = {
  employeeId: string;
  baseSalary: number;
  transportAllowance: number;
  arlRatePct: number;
};

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "payroll-provisions:post",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "CREAR_PROVISIONES_NOMINA",
  );

  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const period = validatePeriod(body?.period);

    if (!period) {
      return new Response("Periodo inválido. Use formato YYYY-MM", {
        status: 400,
      });
    }

    const rawProvisions = Array.isArray(body?.provisions)
      ? (body.provisions as unknown[])
      : [];

    if (rawProvisions.length === 0) {
      return new Response("Debe incluir al menos un empleado", {
        status: 400,
      });
    }

    const provisions: ProvisionInput[] = rawProvisions
      .filter(
        (p): p is Record<string, unknown> =>
          p !== null && typeof p === "object",
      )
      .map((p) => ({
        employeeId: String(p.employeeId ?? "").trim(),
        baseSalary: parseMoney(p.baseSalary),
        transportAllowance: parseMoney(p.transportAllowance),
        arlRatePct: parseMoney(p.arlRatePct),
      }))
      .filter((p) => p.employeeId && p.baseSalary > 0);

    if (provisions.length === 0) {
      return new Response(
        "Ninguna entrada válida. Verifique los datos de cada empleado",
        { status: 400 },
      );
    }

    const employeeIds = provisions.map((p) => p.employeeId);

    const existingRows = await db
      .select({
        employeeId: payrollProvisions.employeeId,
      })
      .from(payrollProvisions)
      .where(
        and(
          eq(payrollProvisions.period, period),
          sql`${payrollProvisions.employeeId} = any(${employeeIds}::uuid[])`,
        ),
      );

    const alreadyExists = new Set(existingRows.map((r) => r.employeeId));
    const newProvisions = provisions.filter(
      (p) => !alreadyExists.has(p.employeeId),
    );
    const duplicates = provisions
      .filter((p) => alreadyExists.has(p.employeeId))
      .map((p) => p.employeeId);

    if (newProvisions.length === 0) {
      return new Response(
        JSON.stringify({
          message:
            "Todos los empleados ya tienen provisiones para este periodo",
          duplicates,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }

    const toInsert = newProvisions.map((p) => {
      const salary = p.baseSalary;
      const transport = p.transportAllowance;
      const arlRate = p.arlRatePct / 100;

      return {
        employeeId: p.employeeId,
        period,
        baseSalary: toMoneyString(salary),
        transportAllowance: toMoneyString(transport),
        severancePay: toMoneyString((salary + transport) / 12),
        severanceInterests: toMoneyString(((salary + transport) / 12) * 0.12),
        serviceBonus: toMoneyString((salary + transport) / 12),
        vacationProvision: toMoneyString(salary / 24),
        healthContribution: toMoneyString(salary * 0.125),
        pensionContribution: toMoneyString(salary * 0.16),
        arlContribution: toMoneyString(salary * arlRate),
        compensationBoxContribution: toMoneyString(salary * 0.04),
      };
    });

    await db.insert(payrollProvisions).values(toInsert);

    void createNotificationsForPermission("VER_PROVISIONES_NOMINA", {
      title: "Provisiones de nómina generadas",
      message: `Se generaron ${toInsert.length} provisiones de nómina para el período ${period}.`,
      href: `/erp/rh/provisiones-nomina`,
    });

    return Response.json({
      created: toInsert.length,
      skippedDuplicates: duplicates.length,
      duplicates,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron generar provisiones de nómina", {
      status: 500,
    });
  }
}
