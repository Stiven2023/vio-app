import { desc, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { inventoryItems } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-items:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const q = String(searchParams.get("q") ?? "").trim();

  const where = q ? ilike(inventoryItems.name, `%${q}%`) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(inventoryItems)
    .where(where);

  const items = await db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      unit: inventoryItems.unit,
    })
    .from(inventoryItems)
    .where(where)
    .orderBy(desc(inventoryItems.name))
    .limit(pageSize)
    .offset(offset);

  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}
