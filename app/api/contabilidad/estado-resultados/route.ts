import { sql } from "drizzle-orm";

import { db } from "@/src/db";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function getPeriodLabel(year: number, periodNum: number, periodType: string): string {
  if (periodType === "annual") return String(year);
  if (periodType === "quarterly") return `T${periodNum}-${year}`;
  const month = new Date(year, periodNum - 1, 1).toLocaleString("es-CO", { month: "short" });
  return `${month} ${year}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:estado-resultados:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_ESTADO_RESULTADOS");
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const periodType = searchParams.get("period") ?? "monthly";

    const dateFrom = `${year}-01-01`;
    const dateTo = `${year}-12-31`;

    // Revenue from approved/invoiced prefacturas
    const revenueRows = await db.execute(sql`
      SELECT
        ${periodType === "annual" ? sql`1` : periodType === "quarterly" ? sql`EXTRACT(QUARTER FROM approved_at)::int` : sql`EXTRACT(MONTH FROM approved_at)::int`} AS period_num,
        COALESCE(SUM(total::numeric), 0) AS amount
      FROM prefacturas
      WHERE approved_at >= ${dateFrom}::date
        AND approved_at <= ${dateTo}::date
        AND status NOT IN ('ANULADA', 'PENDIENTE_CONTABILIDAD')
      GROUP BY period_num
      ORDER BY period_num
    `);

    // COGS from finalized/approved purchase orders
    const cogsRows = await db.execute(sql`
      SELECT
        ${periodType === "annual" ? sql`1` : periodType === "quarterly" ? sql`EXTRACT(QUARTER FROM finalized_at)::int` : sql`EXTRACT(MONTH FROM finalized_at)::int`} AS period_num,
        COALESCE(SUM(total::numeric), 0) AS amount
      FROM purchase_orders
      WHERE finalized_at >= ${dateFrom}::timestamp
        AND finalized_at <= ${dateTo}::timestamp
        AND status IN ('FINALIZADO', 'RECIBIDA', 'APROBADA')
      GROUP BY period_num
      ORDER BY period_num
    `);

    // Payroll from payroll_provisions (period stored as YYYY-MM)
    const payrollRows = await db.execute(sql`
      SELECT
        ${periodType === "annual" ? sql`1` : periodType === "quarterly" ? sql`CEIL(SUBSTRING(period, 6, 2)::int / 3.0)::int` : sql`SUBSTRING(period, 6, 2)::int`} AS period_num,
        COALESCE(SUM(
          base_salary::numeric +
          COALESCE(transport_allowance::numeric, 0) +
          COALESCE(severance_pay::numeric, 0) +
          COALESCE(severance_interests::numeric, 0) +
          COALESCE(service_bonus::numeric, 0) +
          COALESCE(vacation_provision::numeric, 0) +
          COALESCE(health_contribution::numeric, 0) +
          COALESCE(pension_contribution::numeric, 0) +
          COALESCE(arl_contribution::numeric, 0) +
          COALESCE(compensation_box_contribution::numeric, 0)
        ), 0) AS amount
      FROM payroll_provisions
      WHERE SUBSTRING(period, 1, 4) = ${String(year)}
      GROUP BY period_num
      ORDER BY period_num
    `);

    // Operating expenses from petty cash
    const opexRows = await db.execute(sql`
      SELECT
        ${periodType === "annual" ? sql`1` : periodType === "quarterly" ? sql`EXTRACT(QUARTER FROM transaction_date)::int` : sql`EXTRACT(MONTH FROM transaction_date)::int`} AS period_num,
        COALESCE(SUM(amount::numeric), 0) AS amount
      FROM petty_cash_transactions
      WHERE transaction_date >= ${dateFrom}::date
        AND transaction_date <= ${dateTo}::date
        AND transaction_type = 'EXPENSE'
      GROUP BY period_num
      ORDER BY period_num
    `);

    const periodCount = periodType === "annual" ? 1 : periodType === "quarterly" ? 4 : 12;

    const revenueMap: Record<number, number> = {};
    const cogsMap: Record<number, number> = {};
    const payrollMap: Record<number, number> = {};
    const opexMap: Record<number, number> = {};

    for (const r of revenueRows.rows as Record<string, unknown>[]) {
      revenueMap[parseInt(String(r.period_num))] = parseFloat(String(r.amount ?? "0"));
    }
    for (const r of cogsRows.rows as Record<string, unknown>[]) {
      cogsMap[parseInt(String(r.period_num))] = parseFloat(String(r.amount ?? "0"));
    }
    for (const r of payrollRows.rows as Record<string, unknown>[]) {
      payrollMap[parseInt(String(r.period_num))] = parseFloat(String(r.amount ?? "0"));
    }
    for (const r of opexRows.rows as Record<string, unknown>[]) {
      opexMap[parseInt(String(r.period_num))] = parseFloat(String(r.amount ?? "0"));
    }

    const byPeriod = [];
    const periods = [];
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalPayroll = 0;
    let totalOpex = 0;

    for (let i = 1; i <= periodCount; i++) {
      const rev = revenueMap[i] ?? 0;
      const cogs = cogsMap[i] ?? 0;
      const payroll = payrollMap[i] ?? 0;
      const opex = opexMap[i] ?? 0;
      const grossProfit = rev - cogs;
      const operatingIncome = grossProfit - payroll - opex;
      const label = getPeriodLabel(year, i, periodType);

      periods.push(label);
      byPeriod.push({
        period: label,
        revenue: rev,
        cogs,
        payroll,
        operatingExpenses: opex,
        grossProfit,
        operatingIncome,
      });

      totalRevenue += rev;
      totalCOGS += cogs;
      totalPayroll += payroll;
      totalOpex += opex;
    }

    const grossProfit = totalRevenue - totalCOGS;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const totalOperatingCosts = totalPayroll + totalOpex;
    const operatingIncome = grossProfit - totalOperatingCosts;
    const operatingMargin = totalRevenue > 0 ? (operatingIncome / totalRevenue) * 100 : 0;

    return Response.json({
      year,
      periodType,
      periods,
      byPeriod,
      summary: {
        totalRevenue: totalRevenue.toFixed(2),
        totalCOGS: totalCOGS.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        grossMargin: grossMargin.toFixed(2),
        totalPayroll: totalPayroll.toFixed(2),
        totalOperatingExpenses: totalOpex.toFixed(2),
        totalOperatingCosts: totalOperatingCosts.toFixed(2),
        operatingIncome: operatingIncome.toFixed(2),
        operatingMargin: operatingMargin.toFixed(2),
      },
    });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
