import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, payrollProvisions, pilaGenerations } from "@/src/db/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

type ContractTypeKey =
  | "FIXED_TERM"
  | "INDEFINITE_TERM"
  | "WORK_CONTRACT"
  | "SERVICE_CONTRACT";

type PilaRow = {
  id: string;
  employeeId: string;
  employeeName: string | null;
  contractType: ContractTypeKey | null;
  baseSalary: string;
  healthEmployer: string;
  healthEmployee: string;
  pensionEmployer: string;
  pensionEmployee: string;
  arlRatePct: string;
  arlContribution: string;
  compensationBoxRatePct: string;
  compensationBoxContribution: string;
  totalPerEmployee: string;
};

function parseMoney(value: unknown) {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function toMoneyString(value: number) {
  return value.toFixed(2);
}

function validatePeriod(value: unknown) {
  const text = String(value ?? "").trim();

  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : null;
}

function currentPeriod() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");

  return `${d.getFullYear()}-${mm}`;
}

function computeRow(row: {
  id: string;
  employeeId: string;
  employeeName: string | null;
  contractType: ContractTypeKey | null;
  baseSalary: string;
  arlContribution: string;
  compensationBoxContribution: string;
}) {
  const baseSalary = parseMoney(row.baseSalary);

  const healthEmployer = baseSalary * 0.085;
  const healthEmployee = baseSalary * 0.04;
  const pensionEmployer = baseSalary * 0.12;
  const pensionEmployee = baseSalary * 0.04;

  const arlContribution = parseMoney(row.arlContribution);
  const compensationBoxContribution = parseMoney(
    row.compensationBoxContribution,
  );

  const arlRatePct = baseSalary > 0 ? (arlContribution / baseSalary) * 100 : 0;
  const compensationBoxRatePct = 4;

  const totalPerEmployee =
    healthEmployer +
    healthEmployee +
    pensionEmployer +
    pensionEmployee +
    arlContribution +
    compensationBoxContribution;

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    contractType: row.contractType,
    baseSalary: toMoneyString(baseSalary),
    healthEmployer: toMoneyString(healthEmployer),
    healthEmployee: toMoneyString(healthEmployee),
    pensionEmployer: toMoneyString(pensionEmployer),
    pensionEmployee: toMoneyString(pensionEmployee),
    arlRatePct: arlRatePct.toFixed(4),
    arlContribution: toMoneyString(arlContribution),
    compensationBoxRatePct: compensationBoxRatePct.toFixed(2),
    compensationBoxContribution: toMoneyString(compensationBoxContribution),
    totalPerEmployee: toMoneyString(totalPerEmployee),
  } satisfies PilaRow;
}

function summarizeRows(rows: PilaRow[]) {
  let totalHealth = 0;
  let totalPension = 0;
  let totalArl = 0;
  let totalCompensationBox = 0;

  for (const row of rows) {
    totalHealth +=
      parseMoney(row.healthEmployer) + parseMoney(row.healthEmployee);
    totalPension +=
      parseMoney(row.pensionEmployer) + parseMoney(row.pensionEmployee);
    totalArl += parseMoney(row.arlContribution);
    totalCompensationBox += parseMoney(row.compensationBoxContribution);
  }

  return {
    totalHealth: toMoneyString(totalHealth),
    totalPension: toMoneyString(totalPension),
    totalArl: toMoneyString(totalArl),
    totalCompensationBox: toMoneyString(totalCompensationBox),
    grandTotal: toMoneyString(
      totalHealth + totalPension + totalArl + totalCompensationBox,
    ),
  };
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "pila:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PILA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const period =
      validatePeriod(searchParams.get("period")) ?? currentPeriod();
    const employeeId = String(searchParams.get("employeeId") ?? "").trim();

    const clauses = [eq(payrollProvisions.period, period)] as ReturnType<
      typeof eq
    >[];

    if (employeeId) clauses.push(eq(payrollProvisions.employeeId, employeeId));

    const where = and(...clauses);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payrollProvisions)
      .leftJoin(employees, eq(payrollProvisions.employeeId, employees.id))
      .where(where);

    const total = countRow?.count ?? 0;

    const rawRows = await db
      .select({
        id: payrollProvisions.id,
        employeeId: payrollProvisions.employeeId,
        employeeName: employees.name,
        contractType: employees.contractType,
        baseSalary: payrollProvisions.baseSalary,
        arlContribution: payrollProvisions.arlContribution,
        compensationBoxContribution:
          payrollProvisions.compensationBoxContribution,
      })
      .from(payrollProvisions)
      .leftJoin(employees, eq(payrollProvisions.employeeId, employees.id))
      .where(where)
      .orderBy(asc(employees.name))
      .limit(pageSize)
      .offset(offset);

    const items = rawRows.map(computeRow);

    const summaryRows = await db
      .select({
        id: payrollProvisions.id,
        employeeId: payrollProvisions.employeeId,
        employeeName: employees.name,
        contractType: employees.contractType,
        baseSalary: payrollProvisions.baseSalary,
        arlContribution: payrollProvisions.arlContribution,
        compensationBoxContribution:
          payrollProvisions.compensationBoxContribution,
      })
      .from(payrollProvisions)
      .leftJoin(employees, eq(payrollProvisions.employeeId, employees.id))
      .where(and(eq(payrollProvisions.period, period)));

    const summary = summarizeRows(summaryRows.map(computeRow));

    const employeeOptions = await db
      .selectDistinct({
        id: employees.id,
        name: employees.name,
      })
      .from(payrollProvisions)
      .innerJoin(employees, eq(payrollProvisions.employeeId, employees.id))
      .where(eq(payrollProvisions.period, period))
      .orderBy(asc(employees.name));

    const [generated] = await db
      .select({
        id: pilaGenerations.id,
        generatedAt: pilaGenerations.generatedAt,
      })
      .from(pilaGenerations)
      .where(eq(pilaGenerations.period, period))
      .limit(1);

    return Response.json({
      period,
      items,
      employeeOptions,
      summary,
      generation: generated
        ? {
            isGenerated: true,
            generatedAt: generated.generatedAt,
          }
        : {
            isGenerated: false,
            generatedAt: null,
          },
      page,
      pageSize,
      total,
      hasNextPage: offset + pageSize < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo consultar PILA", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "pila:post",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "GENERAR_PILA");

  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const period = validatePeriod(body?.period);
    const confirm = Boolean(body?.confirm);

    if (!period) {
      return new Response("Periodo inválido. Use formato YYYY-MM", {
        status: 400,
      });
    }

    const [alreadyGenerated] = await db
      .select({
        id: pilaGenerations.id,
        generatedAt: pilaGenerations.generatedAt,
      })
      .from(pilaGenerations)
      .where(eq(pilaGenerations.period, period))
      .limit(1);

    if (alreadyGenerated && confirm) {
      return new Response("El periodo ya fue generado y está bloqueado", {
        status: 409,
      });
    }

    const rows = await db
      .select({
        id: payrollProvisions.id,
        employeeId: payrollProvisions.employeeId,
        employeeName: employees.name,
        contractType: employees.contractType,
        baseSalary: payrollProvisions.baseSalary,
        arlContribution: payrollProvisions.arlContribution,
        compensationBoxContribution:
          payrollProvisions.compensationBoxContribution,
      })
      .from(payrollProvisions)
      .leftJoin(employees, eq(payrollProvisions.employeeId, employees.id))
      .where(eq(payrollProvisions.period, period))
      .orderBy(asc(employees.name));

    if (rows.length === 0) {
      return new Response("No hay provisiones de nómina para ese periodo", {
        status: 400,
      });
    }

    const previewRows = rows.map(computeRow);
    const summary = summarizeRows(previewRows);

    if (!confirm) {
      return Response.json({
        period,
        isGenerated: Boolean(alreadyGenerated),
        previewRows,
        summary,
      });
    }

    const generatedBy = getEmployeeIdFromRequest(request);

    await db.insert(pilaGenerations).values({
      period,
      generatedBy,
    });

    const [generation] = await db
      .select({
        id: pilaGenerations.id,
        generatedAt: pilaGenerations.generatedAt,
      })
      .from(pilaGenerations)
      .where(eq(pilaGenerations.period, period))
      .orderBy(desc(pilaGenerations.generatedAt))
      .limit(1);

    void createNotificationsForPermission("VER_PILA", {
      title: "PILA generada",
      message: `Se generó la PILA para el período ${period}.`,
      href: `/erp/hcm/pila`,
    });

    return Response.json({
      period,
      isGenerated: true,
      generatedAt: generation?.generatedAt ?? null,
      previewRows,
      summary,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo generar PILA", { status: 500 });
  }
}
