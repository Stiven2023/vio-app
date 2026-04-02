import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { banks, clients, orderPayments, orders } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

type DepositRow = {
  id: string;
  orderId: string | null;
  bankId: string | null;
  transferBank: string | null;
  bankCode: string | null;
  bankName: string | null;
  bankAccountRef: string | null;
  orderCode: string | null;
  clientCode: string | null;
  clientName: string | null;
  referenceCode: string | null;
  method: string | null;
  status: string | null;
  transferCurrency: string | null;
  depositAmount: string | null;
  amount: string | null;
  orderTotal: string | null;
  creditBalance: string;
  proofImageUrl: string | null;
  createdAt: string | null;
};

const supportedMethods = new Set(["EFECTIVO", "TRANSFERENCIA", "CREDITO"]);

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
    const method = String(searchParams.get("method") ?? "")
      .trim()
      .toUpperCase();
    const currency = String(searchParams.get("currency") ?? "")
      .trim()
      .toUpperCase();
    const dateFrom = String(searchParams.get("dateFrom") ?? "").trim();
    const dateTo = String(searchParams.get("dateTo") ?? "").trim();
    const statusParam = String(searchParams.get("status") ?? "")
      .trim()
      .toUpperCase();

    const validStatuses = new Set([
      "PENDIENTE",
      "PARCIAL",
      "PAGADO",
      "ANULADO",
      "CONFIRMADO_CAJA",
    ]);

    const filters: Array<any> = [
      q
        ? sql`(
            ${orders.orderCode} ilike ${`%${q}%`}
            or ${clients.name} ilike ${`%${q}%`}
            or ${orderPayments.referenceCode} ilike ${`%${q}%`}
            or ${orderPayments.method}::text ilike ${`%${q}%`}
            or ${banks.code} ilike ${`%${q}%`}
            or ${banks.name} ilike ${`%${q}%`}
            or ${banks.accountRef} ilike ${`%${q}%`}
            or ${orderPayments.transferBank} ilike ${`%${q}%`}
          )`
        : undefined,
      method && supportedMethods.has(method)
        ? eq(orderPayments.method, method as any)
        : undefined,
      statusParam && validStatuses.has(statusParam)
        ? eq(orderPayments.status, statusParam as any)
        : undefined,
      bank ? eq(orderPayments.bankId, bank) : undefined,
      currency
        ? eq(sql`coalesce(${orderPayments.transferCurrency}, 'COP')`, currency)
        : undefined,
      dateFrom
        ? sql`date(${orderPayments.createdAt}) >= ${dateFrom}::date`
        : undefined,
      dateTo
        ? sql`date(${orderPayments.createdAt}) <= ${dateTo}::date`
        : undefined,
    ].filter(Boolean);

    const where = filters.length ? and(...filters) : undefined;

    const totalQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(orderPayments)
      .leftJoin(banks, eq(orderPayments.bankId, banks.id))
      .leftJoin(orders, eq(orderPayments.orderId, orders.id))
      .leftJoin(clients, eq(orders.clientId, clients.id));

    const [{ total }] = where
      ? await totalQuery.where(where)
      : await totalQuery;

    const summaryQuery = db
      .select({
        totalGeneral: sql<string>`coalesce(sum(${orderPayments.depositAmount}), 0)::text`,
        totalEfectivo: sql<string>`coalesce(sum(case when ${orderPayments.method} = 'EFECTIVO' then ${orderPayments.depositAmount} else 0 end), 0)::text`,
        totalTransferencias: sql<string>`coalesce(sum(case when ${orderPayments.method} = 'TRANSFERENCIA' then ${orderPayments.depositAmount} else 0 end), 0)::text`,
      })
      .from(orderPayments)
      .leftJoin(banks, eq(orderPayments.bankId, banks.id))
      .leftJoin(orders, eq(orderPayments.orderId, orders.id))
      .leftJoin(clients, eq(orders.clientId, clients.id));

    const [summary] = where
      ? await summaryQuery.where(where)
      : await summaryQuery;

    const itemsQuery = db
      .select({
        id: orderPayments.id,
        orderId: orderPayments.orderId,
        bankId: orderPayments.bankId,
        transferBank: orderPayments.transferBank,
        bankCode: banks.code,
        bankName: banks.name,
        bankAccountRef: banks.accountRef,
        orderCode: orders.orderCode,
        clientCode: clients.clientCode,
        clientName: clients.name,
        referenceCode: orderPayments.referenceCode,
        method: orderPayments.method,
        status: orderPayments.status,
        transferCurrency: orderPayments.transferCurrency,
        depositAmount: orderPayments.depositAmount,
        amount: orderPayments.amount,
        orderTotal: orders.total,
        proofImageUrl: orderPayments.proofImageUrl,
        createdAt: orderPayments.createdAt,
      })
      .from(orderPayments)
      .leftJoin(banks, eq(orderPayments.bankId, banks.id))
      .leftJoin(orders, eq(orderPayments.orderId, orders.id))
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .orderBy(desc(orderPayments.createdAt))
      .limit(pageSize)
      .offset(offset);

    const rows = where ? await itemsQuery.where(where) : await itemsQuery;

    const items: DepositRow[] = rows.map((row) => {
      const consignado = Number(row.depositAmount ?? 0);
      const valorPedido = Number(row.orderTotal ?? 0);
      const favor = Math.max(0, consignado - valorPedido);

      return {
        ...row,
        creditBalance: String(Number.isFinite(favor) ? favor : 0),
        createdAt: row.createdAt ? String(row.createdAt) : null,
      };
    });

    const hasNextPage = offset + items.length < total;

    return Response.json({
      items,
      summary: {
        totalGeneral: String(summary?.totalGeneral ?? "0"),
        totalEfectivo: String(summary?.totalEfectivo ?? "0"),
        totalTransferencias: String(summary?.totalTransferencias ?? "0"),
      },
      page,
      pageSize,
      total,
      hasNextPage,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Failed to fetch deposits", { status: 500 });
  }
}
