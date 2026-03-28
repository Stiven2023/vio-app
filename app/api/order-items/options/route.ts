import { and, desc, eq, ilike, notInArray, or, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { orderItems, orders } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import {
  ensureDateRange,
  parsePaginationStrict,
} from "@/src/utils/pagination";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "order-items:options",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePaginationStrict(searchParams, {
      defaultPageSize: 20,
      maxPageSize: 100,
    });
    const q = String(searchParams.get("q") ?? "").trim();
    const range = ensureDateRange(searchParams, {
      defaultDays: 30,
      maxDays: 365,
    });
    const effectivePageSize = q ? pageSize : Math.min(pageSize, 50);
    const filters = [
      notInArray(orderItems.status, ["COMPLETADO", "CANCELADO"] as any),
      sql`date(${orderItems.createdAt}) >= ${range.dateFrom}::date`,
      sql`date(${orderItems.createdAt}) <= ${range.dateTo}::date`,
      q
        ? or(
            ilike(orderItems.name, `%${q}%`),
            ilike(orders.orderCode, `%${q}%`),
          )
        : undefined,
    ].filter(Boolean);
    const where = and(...filters);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(orderItems)
      .leftJoin(orders, eq(orderItems.orderId, orders.id))
      .where(where);

    const items = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        orderCode: orders.orderCode,
        name: orderItems.name,
        status: orderItems.status,
        createdAt: orderItems.createdAt,
      })
      .from(orderItems)
      .leftJoin(orders, eq(orderItems.orderId, orders.id))
      .where(where)
      .orderBy(desc(orderItems.createdAt))
      .limit(effectivePageSize)
      .offset(offset);

    return Response.json({
      items,
      page,
      pageSize: effectivePageSize,
      total,
      hasNextPage: offset + items.length < total,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    if (error instanceof RangeError) {
      return new Response(error.message, { status: 400 });
    }

    return new Response("No se pudieron cargar diseños", { status: 500 });
  }
}
