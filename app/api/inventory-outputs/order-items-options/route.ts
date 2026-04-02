import { desc, eq, notInArray } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, orderItems, orders } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-outputs:order-items-options:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_SALIDA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const pageSize = Math.min(
      400,
      Math.max(20, Number(searchParams.get("pageSize") ?? 200)),
    );

    const items = await db
      .select({
        id: orderItems.id,
        orderCode: orders.orderCode,
        name: orderItems.name,
        status: orderItems.status,
        requesterEmployeeName: employees.name,
        createdAt: orderItems.createdAt,
      })
      .from(orderItems)
      .leftJoin(orders, eq(orderItems.orderId, orders.id))
      .leftJoin(employees, eq(orders.createdBy, employees.id))
      .where(notInArray(orderItems.status, ["COMPLETADO", "CANCELADO"] as any))
      .orderBy(desc(orderItems.createdAt))
      .limit(pageSize);

    return Response.json({ items });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron cargar opciones de salida", {
      status: 500,
    });
  }
}
