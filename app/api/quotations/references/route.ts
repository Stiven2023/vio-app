import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, orderItems, orders } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "quotations:references:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_COTIZACION");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("q") ?? "").trim();
    const orderId = String(searchParams.get("orderId") ?? "").trim();

    if (orderId) {
      const items = await db
        .select({
          id: orderItems.id,
          name: orderItems.name,
          manufacturingId: orderItems.manufacturingId,
          imageUrl: orderItems.imageUrl,
          quantity: orderItems.quantity,
          status: orderItems.status,
          createdAt: orderItems.createdAt,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
        .orderBy(desc(orderItems.createdAt))
        .limit(80);

      const designs = items.map((item, index) => ({
        id: item.id,
        designNumber:
          item.manufacturingId?.trim() ||
          item.name?.trim() ||
          `DIS-${String(index + 1).padStart(2, "0")}`,
        designName: item.name ?? "Diseño",
        previewImageUrl: item.imageUrl,
        quantity: item.quantity,
        status: item.status,
      }));

      return Response.json({ designs });
    }

    const whereClause = query
      ? and(ilike(orders.orderCode, `%${query}%`))
      : undefined;

    const rows = await db
      .select({
        id: orders.id,
        orderCode: orders.orderCode,
        status: orders.status,
        kind: orders.kind,
        currency: orders.currency,
        clientName: clients.name,
        itemCount: sql<number>`(
          select count(*)::int
          from order_items oi
          where oi.order_id = ${orders.id}
        )`,
      })
      .from(orders)
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(25);

    return Response.json({ orders: rows });
  } catch {
    return new Response("No se pudieron cargar referencias", { status: 500 });
  }
}
