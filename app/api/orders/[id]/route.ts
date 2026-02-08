import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, orders } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "orders:get-one",
    limit: 300,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderId = String(id ?? "").trim();

  if (!orderId) return new Response("id required", { status: 400 });

  const [row] = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      kind: (orders as any).kind,
      sourceOrderId: (orders as any).sourceOrderId,
      sourceOrderCode: sql<
        string | null
      >`(select o2.order_code from orders o2 where o2.id = ${(orders as any).sourceOrderId})`,
      clientId: orders.clientId,
      clientName: clients.name,
      type: orders.type,
      status: orders.status,
      total: orders.total,
      ivaEnabled: orders.ivaEnabled,
      discount: orders.discount,
      currency: orders.currency,
      shippingFee: (orders as any).shippingFee,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  return Response.json(row);
}
