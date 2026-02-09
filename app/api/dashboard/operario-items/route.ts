import { desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  inventoryItems,
  orderItemMaterials,
  orderItems,
  orders,
} from "@/src/db/schema";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { getAllowedStatusesForRole } from "@/src/utils/role-status";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "dashboard:operario-items",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);
  if (!role) return new Response("Unauthorized", { status: 401 });

  const allowedStatuses = getAllowedStatusesForRole(role);
  if (allowedStatuses.length === 0) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);

  const statusFilter = inArray(orderItems.status, allowedStatuses as any);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(orderItems)
    .where(statusFilter);

  const items = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      orderCode: orders.orderCode,
      clientName: clients.name,
      name: orderItems.name,
      quantity: orderItems.quantity,
      status: orderItems.status,
      imageUrl: orderItems.imageUrl,
      createdAt: orderItems.createdAt,
      confectionistName: sql<string | null>`(
        select c.name
        from order_item_confection oic
        join confectionists c on c.id = oic.confectionist_id
        where oic.order_item_id = ${sql.raw('"order_items"."id"')}
          and oic.finished_at is null
        order by oic.assigned_at desc
        limit 1
      )`,
    })
    .from(orderItems)
    .leftJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .where(statusFilter)
    .orderBy(desc(orderItems.createdAt))
    .limit(pageSize)
    .offset(offset);

  const itemIds = items.map((row) => row.id).filter(Boolean);
  const materialsRows = itemIds.length
    ? await db
        .select({
          orderItemId: orderItemMaterials.orderItemId,
          inventoryItemId: orderItemMaterials.inventoryItemId,
          itemName: inventoryItems.name,
          quantity: orderItemMaterials.quantity,
          note: orderItemMaterials.note,
        })
        .from(orderItemMaterials)
        .leftJoin(
          inventoryItems,
          eq(orderItemMaterials.inventoryItemId, inventoryItems.id),
        )
        .where(inArray(orderItemMaterials.orderItemId, itemIds as any))
    : [];

  const materialsByItem = new Map<string, typeof materialsRows>();
  for (const row of materialsRows) {
    if (!row.orderItemId) continue;
    const list = materialsByItem.get(row.orderItemId) ?? [];
    list.push(row);
    materialsByItem.set(row.orderItemId, list);
  }

  const withMaterials = items.map((item) => ({
    ...item,
    materials: materialsByItem.get(item.id) ?? [],
  }));

  const hasNextPage = offset + items.length < total;

  return Response.json({ items: withMaterials, page, pageSize, total, hasNextPage });
}
