import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, products } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "orders:options:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  try {
    const clientItems = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(and(eq(clients.isActive, true)));

    const productItems = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.isActive, true)));

    return Response.json({ clients: clientItems, products: productItems });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo cargar opciones", { status: 500 });
  }
}
