import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { inventoryEntries, inventoryOutputs } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-stock:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const itemId = String(searchParams.get("inventoryItemId") ?? "").trim();

    if (!itemId)
      return new Response("inventoryItemId required", { status: 400 });

    const [entriesRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${inventoryEntries.quantity}), 0)::text`,
      })
      .from(inventoryEntries)
      .where(eq(inventoryEntries.inventoryItemId, itemId));

    const [outputsRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${inventoryOutputs.quantity}), 0)::text`,
      })
      .from(inventoryOutputs)
      .where(eq(inventoryOutputs.inventoryItemId, itemId));

    const stock = asNumber(entriesRow?.total) - asNumber(outputsRow?.total);

    return Response.json({ inventoryItemId: itemId, stock });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar stock", { status: 500 });
  }
}
