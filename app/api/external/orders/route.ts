import { and, desc, eq, ilike } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, orders } from "@/src/db/erp/schema";
import { requireExternalAccessActiveClient } from "@/src/utils/external-auth";

export async function GET(request: Request) {
  const { error, payload } = await requireExternalAccessActiveClient(request);

  if (error) return error;

  const { searchParams } = new URL(request.url);
  const orderCode = String(searchParams.get("orderCode") ?? "")
    .trim()
    .toUpperCase();

  const where = orderCode
    ? and(
        eq(orders.clientId, payload.clientId),
        ilike(orders.orderCode, `%${orderCode}%`),
      )
    : eq(orders.clientId, payload.clientId);

  const rows = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      status: orders.status,
      type: orders.type,
      total: orders.total,
      createdAt: orders.createdAt,
      clientCode: clients.clientCode,
      clientName: clients.name,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(80);

  return Response.json({ items: rows });
}
