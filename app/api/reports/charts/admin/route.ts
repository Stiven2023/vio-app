import { and, gte, lte, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { orderPayments, orders } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function toMonthRange(year?: number, month?: number) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);

  return { start, end, year: y, month: m };
}

function buildDays(year: number, month: number) {
  const days: string[] = [];
  const count = new Date(year, month, 0).getDate();
  for (let d = 1; d <= count; d += 1) {
    days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "charts:admin",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);
  if (!role) return new Response("Unauthorized", { status: 401 });
  if (role !== "ADMINISTRADOR" && role !== "LIDER_DE_PROCESOS") {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year") ?? "");
    const month = Number(searchParams.get("month") ?? "");
    const range = toMonthRange(
      Number.isFinite(year) && year > 0 ? year : undefined,
      Number.isFinite(month) && month > 0 ? month : undefined,
    );

    const ordersRows = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${orders.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
        soldTotal: sql<string>`coalesce(sum(${orders.total} + coalesce(${orders.shippingFee}, 0)), 0)::text`,
      })
      .from(orders)
      .where(
        and(gte(orders.createdAt, range.start), lte(orders.createdAt, range.end)),
      )
      .groupBy(sql`date_trunc('day', ${orders.createdAt})`)
      .orderBy(sql`date_trunc('day', ${orders.createdAt})`);

    const paymentsRows = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${orderPayments.createdAt}), 'YYYY-MM-DD')`,
        paidTotal: sql<string>`coalesce(sum(${orderPayments.amount}), 0)::text`,
      })
      .from(orderPayments)
      .where(
        and(
          gte(orderPayments.createdAt, range.start),
          lte(orderPayments.createdAt, range.end),
          sql`${orderPayments.status} <> 'ANULADO'`,
        ),
      )
      .groupBy(sql`date_trunc('day', ${orderPayments.createdAt})`)
      .orderBy(sql`date_trunc('day', ${orderPayments.createdAt})`);

    const soldByDay = new Map(
      ordersRows.map((row) => [row.day, Number(row.soldTotal ?? 0)]),
    );
    const countByDay = new Map(
      ordersRows.map((row) => [row.day, Number(row.count ?? 0)]),
    );
    const paidByDay = new Map(
      paymentsRows.map((row) => [row.day, Number(row.paidTotal ?? 0)]),
    );

    const days = buildDays(range.year, range.month);
    const series = days.map((day) => ({
      day,
      sold: soldByDay.get(day) ?? 0,
      paid: paidByDay.get(day) ?? 0,
      orders: countByDay.get(day) ?? 0,
    }));

    return Response.json({ year: range.year, month: range.month, series });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar graficos", { status: 500 });
  }
}
