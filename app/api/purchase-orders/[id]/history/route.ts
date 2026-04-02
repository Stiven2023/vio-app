import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, purchaseOrderHistory } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "purchase-orders:history:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const orderId = String(id ?? "").trim();

    if (!orderId) return new Response("id required", { status: 400 });

    const items = await db
      .select({
        id: purchaseOrderHistory.id,
        action: purchaseOrderHistory.action,
        notes: purchaseOrderHistory.notes,
        performedBy: purchaseOrderHistory.performedBy,
        performedByName: employees.name,
        createdAt: purchaseOrderHistory.createdAt,
      })
      .from(purchaseOrderHistory)
      .leftJoin(employees, eq(purchaseOrderHistory.performedBy, employees.id))
      .where(eq(purchaseOrderHistory.purchaseOrderId, orderId))
      .orderBy(desc(purchaseOrderHistory.createdAt));

    return Response.json({ items });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo consultar historial de compra", {
      status: 500,
    });
  }
}
