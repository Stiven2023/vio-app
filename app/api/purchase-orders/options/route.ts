import { asc } from "drizzle-orm";

import { db } from "@/src/db";
import { inventoryItems, suppliers } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "purchase-orders:options",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");
  if (forbidden) return forbidden;

  try {
    const [supplierRows, itemRows] = await Promise.all([
      db
        .select({ id: suppliers.id, name: suppliers.name, isActive: suppliers.isActive })
        .from(suppliers)
        .orderBy(asc(suppliers.name)),
      db
        .select({ id: inventoryItems.id, name: inventoryItems.name, unit: inventoryItems.unit })
        .from(inventoryItems)
        .orderBy(asc(inventoryItems.name)),
    ]);

    return Response.json({ suppliers: supplierRows, inventoryItems: itemRows });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudieron cargar opciones", { status: 500 });
  }
}
