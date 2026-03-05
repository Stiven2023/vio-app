import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { orderPayments, orders } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

type ConsignacionRow = {
  id: string;
  orderCode: string | null;
  transferBank: string | null;
  referenceCode: string | null;
  status: string | null;
  transferCurrency: string | null;
  depositAmount: string | null;
  orderTotal: string | null;
  valorAFavor: string;
  createdAt: string | null;
};

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:consignaciones:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = String(searchParams.get("q") ?? "").trim();
    const bank = String(searchParams.get("bank") ?? "").trim();
    const currency = String(searchParams.get("currency") ?? "").trim().toUpperCase();
    const dateFrom = String(searchParams.get("dateFrom") ?? "").trim();
    const dateTo = String(searchParams.get("dateTo") ?? "").trim();

    const filters: Array<any> = [
      eq(orderPayments.method, "TRANSFERENCIA" as any),
      q
        ? sql`(
            ${orders.orderCode} ilike ${`%${q}%`}
            or ${orderPayments.referenceCode} ilike ${`%${q}%`}
            or ${orderPayments.transferBank} ilike ${`%${q}%`}
          )`
        : undefined,
      bank ? eq(orderPayments.transferBank, bank) : undefined,
      currency ? eq(orderPayments.transferCurrency, currency) : undefined,
      dateFrom ? sql`date(${orderPayments.createdAt}) >= ${dateFrom}::date` : undefined,
      dateTo ? sql`date(${orderPayments.createdAt}) <= ${dateTo}::date` : undefined,
    ].filter(Boolean);

    const where = filters.length ? and(...filters) : undefined;

    const totalQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(orderPayments)
      .leftJoin(orders, eq(orderPayments.orderId, orders.id));

    const [{ total }] = where
      ? await totalQuery.where(where)
      : await totalQuery;

    const itemsQuery = db
      .select({
        id: orderPayments.id,
        orderCode: orders.orderCode,
        transferBank: orderPayments.transferBank,
        referenceCode: orderPayments.referenceCode,
        status: orderPayments.status,
        transferCurrency: orderPayments.transferCurrency,
        depositAmount: orderPayments.depositAmount,
        orderTotal: orders.total,
        createdAt: orderPayments.createdAt,
      })
      .from(orderPayments)
      .leftJoin(orders, eq(orderPayments.orderId, orders.id))
      .orderBy(desc(orderPayments.createdAt))
      .limit(pageSize)
      .offset(offset);

    const rows = where ? await itemsQuery.where(where) : await itemsQuery;

    const items: ConsignacionRow[] = rows.map((row) => {
      const consignado = Number(row.depositAmount ?? 0);
      const valorPedido = Number(row.orderTotal ?? 0);
      const favor = Math.max(0, consignado - valorPedido);

      return {
        ...row,
        valorAFavor: String(Number.isFinite(favor) ? favor : 0),
        createdAt: row.createdAt ? String(row.createdAt) : null,
      };
    });

    const hasNextPage = offset + items.length < total;

    return Response.json({
      items,
      page,
      pageSize,
      total,
      hasNextPage,
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudieron consultar consignaciones", { status: 500 });
  }
}
