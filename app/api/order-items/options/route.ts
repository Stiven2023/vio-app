import { desc, eq, notInArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { orderItems, orders } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
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
    const pageSize = Math.min(400, Math.max(20, Number(searchParams.get("pageSize") ?? 200)));

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
      .where(notInArray(orderItems.status, ["COMPLETADO", "CANCELADO"] as any))
      .orderBy(desc(orderItems.createdAt))
      .limit(pageSize);

    return Response.json({ items });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudieron cargar diseños", { status: 500 });
  }
}
