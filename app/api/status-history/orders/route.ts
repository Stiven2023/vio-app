import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, orders, orderStatusHistory } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "status-history:orders:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_HISTORIAL_ESTADO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const orderId = String(searchParams.get("orderId") ?? "").trim();

  const where = orderId ? eq(orderStatusHistory.orderId, orderId) : undefined;

  const totalQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(orderStatusHistory);

  const [{ total }] = where ? await totalQuery.where(where) : await totalQuery;

  const itemsQuery = db
    .select({
      id: orderStatusHistory.id,
      orderId: orderStatusHistory.orderId,
      orderCode: orders.orderCode,
      status: orderStatusHistory.status,
      changedBy: orderStatusHistory.changedBy,
      changedByName: employees.name,
      createdAt: orderStatusHistory.createdAt,
    })
    .from(orderStatusHistory)
    .leftJoin(orders, eq(orderStatusHistory.orderId, orders.id))
    .leftJoin(employees, eq(orderStatusHistory.changedBy, employees.id))
    .orderBy(desc(orderStatusHistory.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items = where ? await itemsQuery.where(where) : await itemsQuery;
  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}
