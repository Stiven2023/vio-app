import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  employees,
  orderItemStatusHistory,
  orderItems,
  orders,
} from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "status-history:order-items:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_HISTORIAL_ESTADO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const orderItemId = String(searchParams.get("orderItemId") ?? "").trim();

  const where = orderItemId
    ? eq(orderItemStatusHistory.orderItemId, orderItemId)
    : undefined;

  const totalQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(orderItemStatusHistory);

  const [{ total }] = where ? await totalQuery.where(where) : await totalQuery;

  const itemsQuery = db
    .select({
      id: orderItemStatusHistory.id,
      orderItemId: orderItemStatusHistory.orderItemId,
      itemName: orderItems.name,
      orderId: orderItems.orderId,
      orderCode: orders.orderCode,
      status: orderItemStatusHistory.status,
      changedBy: orderItemStatusHistory.changedBy,
      changedByName: employees.name,
      createdAt: orderItemStatusHistory.createdAt,
    })
    .from(orderItemStatusHistory)
    .leftJoin(orderItems, eq(orderItemStatusHistory.orderItemId, orderItems.id))
    .leftJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(employees, eq(orderItemStatusHistory.changedBy, employees.id))
    .orderBy(desc(orderItemStatusHistory.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items = where ? await itemsQuery.where(where) : await itemsQuery;
  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}
